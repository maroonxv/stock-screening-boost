"use client";

import { useState } from "react";

import { api } from "~/trpc/react";

export function LatestPost() {
  const [latestPost] = api.post.getLatest.useSuspenseQuery();

  const utils = api.useUtils();
  const [name, setName] = useState("");
  const createPost = api.post.create.useMutation({
    onSuccess: async () => {
      await utils.post.invalidate();
      setName("");
    },
  });

  return (
    <div className="market-soft-panel w-full max-w-xs rounded-2xl p-4 text-[#d8e8f8]">
      {latestPost ? (
        <p className="truncate text-sm">
          Your most recent post: {latestPost.name}
        </p>
      ) : (
        <p className="text-sm text-[#9cb4cb]">You have no posts yet.</p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          createPost.mutate({ name });
        }}
        className="mt-3 flex flex-col gap-2"
      >
        <input
          type="text"
          placeholder="Title"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-full border border-[#587493]/45 bg-[#0a1a2d] px-4 py-2 text-sm text-[#e7f4ff] placeholder:text-[#7a96b2]"
        />
        <button
          type="submit"
          className="market-button-primary rounded-full px-10 py-3 text-sm font-semibold transition"
          disabled={createPost.isPending}
        >
          {createPost.isPending ? "Submitting..." : "Submit"}
        </button>
      </form>
    </div>
  );
}
