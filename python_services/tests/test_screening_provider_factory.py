from __future__ import annotations


def test_strict_screening_provider_ignores_legacy_ifind_env(monkeypatch):
    import app.providers.screening.factory as factory

    class FakeTushareProvider:
        provider_name = "tushare"

    class UnexpectedIFindProvider:
        def __init__(self) -> None:
            raise AssertionError("strict screening provider should not instantiate iFinD")

    factory.get_strict_screening_provider.cache_clear()
    monkeypatch.setenv("SCREENING_PRIMARY_PROVIDER", "ifind")
    monkeypatch.delenv("SCREENING_ENABLE_AKSHARE_FALLBACK", raising=False)
    monkeypatch.setattr(factory, "TushareScreeningProvider", FakeTushareProvider)
    monkeypatch.setattr(factory, "IFindScreeningProvider", UnexpectedIFindProvider)

    provider = factory.get_strict_screening_provider()

    assert provider.provider_name == "tushare"
