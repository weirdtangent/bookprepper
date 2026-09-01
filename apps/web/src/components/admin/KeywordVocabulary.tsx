import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type AdminKeyword } from "../../lib/api";

const QUERY_KEY = ["admin-keywords"];

type Props = {
  token: string;
};

export function KeywordVocabulary({ token }: Props) {
  const queryClient = useQueryClient();
  const [aliasTargets, setAliasTargets] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const keywordsQuery = useQuery<{ keywords: AdminKeyword[] }>({
    queryKey: QUERY_KEY,
    queryFn: () => api.adminListKeywords(token),
  });

  const keywords = useMemo(() => keywordsQuery.data?.keywords ?? [], [keywordsQuery.data]);

  const canonical = useMemo(
    () => keywords.filter((keyword) => keyword.status === "CANONICAL"),
    [keywords]
  );
  const pending = useMemo(
    () => keywords.filter((keyword) => keyword.status === "PENDING"),
    [keywords]
  );
  const aliases = useMemo(
    () => keywords.filter((keyword) => keyword.status === "ALIAS"),
    [keywords]
  );

  const refresh = () => {
    setError(null);
    queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    // The library filter is derived from this vocabulary, so it goes stale too.
    queryClient.invalidateQueries({ queryKey: ["prep-keywords"] });
  };

  const onError = (mutationError: unknown) => {
    setError(mutationError instanceof Error ? mutationError.message : "Something went wrong.");
  };

  const statusMutation = useMutation({
    mutationFn: (variables: { id: string; status: "CANONICAL" | "PENDING" }) =>
      api.adminUpdateKeyword({ id: variables.id, token, body: { status: variables.status } }),
    onSuccess: refresh,
    onError,
  });

  const aliasMutation = useMutation({
    mutationFn: (variables: { id: string; aliasOfId: string }) =>
      api.adminAliasKeyword({ id: variables.id, aliasOfId: variables.aliasOfId, token }),
    onSuccess: refresh,
    onError,
  });

  const deleteMutation = useMutation({
    mutationFn: (variables: { id: string }) => api.adminDeleteKeyword({ id: variables.id, token }),
    onSuccess: refresh,
    onError,
  });

  const isBusy = statusMutation.isPending || aliasMutation.isPending || deleteMutation.isPending;

  if (keywordsQuery.isLoading) {
    return <p>Loading keywords…</p>;
  }

  if (keywordsQuery.isError) {
    return <p role="alert">Could not load the keyword vocabulary.</p>;
  }

  const renderAliasControl = (keyword: AdminKeyword) => (
    <div className="keyword-row__alias">
      <select
        aria-label={`Alias ${keyword.name} onto`}
        value={aliasTargets[keyword.id] ?? ""}
        onChange={(event) =>
          setAliasTargets((current) => ({ ...current, [keyword.id]: event.target.value }))
        }
      >
        <option value="">Merge into…</option>
        {canonical
          .filter((target) => target.id !== keyword.id)
          .map((target) => (
            <option key={target.id} value={target.id}>
              {target.name}
            </option>
          ))}
      </select>
      <button
        type="button"
        disabled={isBusy || !aliasTargets[keyword.id]}
        onClick={() =>
          aliasMutation.mutate({ id: keyword.id, aliasOfId: aliasTargets[keyword.id] })
        }
      >
        Merge
      </button>
    </div>
  );

  return (
    <div className="keyword-vocabulary">
      {error && (
        <p role="alert" className="keyword-vocabulary__error">
          {error}
        </p>
      )}

      <section>
        <h3>
          In the filter <small>{canonical.length}</small>
        </h3>
        <p className="keyword-vocabulary__hint">
          These are the only keywords the library filter offers.
        </p>
        <ul className="keyword-list">
          {canonical.map((keyword) => (
            <li key={keyword.id} className="keyword-row">
              <span className="keyword-row__name">{keyword.name}</span>
              <span className="keyword-row__usage">
                {keyword.bookCount} book{keyword.bookCount === 1 ? "" : "s"}
                {keyword.aliasCount > 0 && ` · ${keyword.aliasCount} alias`}
              </span>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => statusMutation.mutate({ id: keyword.id, status: "PENDING" })}
              >
                Remove from filter
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3>
          Awaiting review <small>{pending.length}</small>
        </h3>
        <p className="keyword-vocabulary__hint">
          Free text from prep authoring. Promote it, merge it into a canonical keyword, or delete it
          if nothing uses it.
        </p>
        <ul className="keyword-list">
          {pending.map((keyword) => (
            <li key={keyword.id} className="keyword-row">
              <span className="keyword-row__name">{keyword.name}</span>
              <span className="keyword-row__usage">
                {keyword.bookCount} book{keyword.bookCount === 1 ? "" : "s"}
              </span>
              <div className="keyword-row__actions">
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => statusMutation.mutate({ id: keyword.id, status: "CANONICAL" })}
                >
                  Promote
                </button>
                {renderAliasControl(keyword)}
                {keyword.prepCount === 0 && (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => deleteMutation.mutate({ id: keyword.id })}
                  >
                    Delete
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {aliases.length > 0 && (
        <section>
          <h3>
            Merged <small>{aliases.length}</small>
          </h3>
          <p className="keyword-vocabulary__hint">
            Preps authored with these names attach to the canonical keyword instead.
          </p>
          <ul className="keyword-list">
            {aliases.map((keyword) => (
              <li key={keyword.id} className="keyword-row">
                <span className="keyword-row__name">{keyword.name}</span>
                <span className="keyword-row__usage">→ {keyword.aliasOf?.name ?? "unknown"}</span>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => statusMutation.mutate({ id: keyword.id, status: "PENDING" })}
                >
                  Un-merge
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
