"""Safe formula validation and evaluation for screening workbench formulas."""

from __future__ import annotations

from dataclasses import dataclass
import ast
from typing import Iterable


@dataclass(frozen=True)
class FormulaValidationResult:
    valid: bool
    normalized_expression: str | None
    referenced_metrics: list[str]
    errors: list[str]


class SafeFormulaEngine:
    _ALLOWED_BINARY_NODES = (
        ast.Add,
        ast.Sub,
        ast.Mult,
        ast.Div,
        ast.Mod,
    )
    _ALLOWED_UNARY_NODES = (ast.UAdd, ast.USub)

    def validate(
        self,
        *,
        expression: str,
        target_indicators: list[str],
    ) -> FormulaValidationResult:
        errors: list[str] = []
        normalized = expression.strip()

        if not normalized:
            errors.append("公式表达式不能为空")

        if len(target_indicators) > 5:
            errors.append("target indicators cannot exceed 5 entries")

        try:
            parsed = ast.parse(normalized, mode="eval")
            referenced_indexes = sorted(self._collect_indexes(parsed))
            self._validate_node(parsed)
        except SyntaxError as exc:
            errors.append(f"invalid syntax: {exc.msg}")
            parsed = None
            referenced_indexes = []
        except ValueError as exc:
            errors.append(str(exc))
            parsed = None
            referenced_indexes = []

        referenced_metrics = [
            target_indicators[index]
            for index in referenced_indexes
            if index < len(target_indicators)
        ]

        return FormulaValidationResult(
            valid=len(errors) == 0,
            normalized_expression=ast.unparse(parsed) if parsed else None,
            referenced_metrics=referenced_metrics,
            errors=errors,
        )

    def evaluate(
        self,
        *,
        expression: str,
        variables: list[float | None],
    ) -> float | None:
        validation = self.validate(
            expression=expression,
            target_indicators=[""] * min(max(len(variables), 1), 5),
        )
        if not validation.valid:
            raise ValueError("; ".join(validation.errors))

        parsed = ast.parse(expression, mode="eval")
        return self._evaluate_node(parsed.body, variables)

    def _validate_node(self, node: ast.AST) -> None:
        if isinstance(node, ast.Expression):
            self._validate_node(node.body)
            return

        if isinstance(node, ast.BinOp):
            if not isinstance(node.op, self._ALLOWED_BINARY_NODES):
                raise ValueError("only + - * / % operators are allowed")
            self._validate_node(node.left)
            self._validate_node(node.right)
            return

        if isinstance(node, ast.UnaryOp):
            if not isinstance(node.op, self._ALLOWED_UNARY_NODES):
                raise ValueError("only unary +/- operators are allowed")
            self._validate_node(node.operand)
            return

        if isinstance(node, ast.Subscript):
            if not isinstance(node.value, ast.Name) or node.value.id != "var":
                raise ValueError("only var[index] references are allowed")
            if not isinstance(node.slice, ast.Constant) or not isinstance(
                node.slice.value, int
            ):
                raise ValueError("var index must be an integer literal")
            if node.slice.value < 0 or node.slice.value >= 5:
                raise ValueError("var index must be between 0 and 4")
            return

        if isinstance(node, ast.Constant) and isinstance(
            node.value, (int, float)
        ):
            return

        raise ValueError(f"unsupported syntax: {type(node).__name__}")

    def _collect_indexes(self, node: ast.AST) -> Iterable[int]:
        if isinstance(node, ast.Subscript):
            if isinstance(node.slice, ast.Constant) and isinstance(
                node.slice.value, int
            ):
                yield node.slice.value
            return

        for child in ast.iter_child_nodes(node):
            yield from self._collect_indexes(child)

    def _evaluate_node(
        self,
        node: ast.AST,
        variables: list[float | None],
    ) -> float | None:
        if isinstance(node, ast.BinOp):
            left = self._evaluate_node(node.left, variables)
            right = self._evaluate_node(node.right, variables)
            if left is None or right is None:
                return None

            if isinstance(node.op, ast.Add):
                return left + right
            if isinstance(node.op, ast.Sub):
                return left - right
            if isinstance(node.op, ast.Mult):
                return left * right
            if isinstance(node.op, ast.Div):
                return None if right == 0 else left / right
            if isinstance(node.op, ast.Mod):
                return None if right == 0 else left % right

        if isinstance(node, ast.UnaryOp):
            operand = self._evaluate_node(node.operand, variables)
            if operand is None:
                return None
            if isinstance(node.op, ast.UAdd):
                return operand
            if isinstance(node.op, ast.USub):
                return -operand

        if isinstance(node, ast.Subscript):
            index = node.slice.value if isinstance(node.slice, ast.Constant) else 0
            return variables[index]

        if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
            return float(node.value)

        raise ValueError(f"unsupported node during evaluation: {type(node).__name__}")
