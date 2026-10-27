# Server data hooks

Use `useApiQuery<T>(path, options)` for GET requests with loading, errors,
cancellation, and refresh. Feature hooks such as `usePhotoFeed`,
`useNotifications`, and `useAccountReports` define URLs and resource types.

```tsx
const { data: photos = [], loading, error, refresh } = usePhotoFeed(feed);
```

`QueryProvider` lives inside `AccountProvider`. Queries wait for the account
check, and authenticated queries do not run for guests. Keys include the
account and URL, so feed tabs, pagination, and report filters have separate
entries. Changing accounts removes the old account's cache and cancels its requests.
Data is held in memory only.

Queries are fresh for 30 seconds, refresh when stale on window focus or
reconnection, and do not automatically retry failed requests. Notifications
also poll every 30 seconds while the page is visible. Use `refresh` for a
manual retry. A failed refresh hides previously cached records so a removed
post or unauthorized view does not stay visible.

During this incremental migration, successful writes through `api()` notify
the provider to invalidate API queries. Reaction changes mark feeds stale for
their next visit/focus and refresh notification data, without refetching the
visible feed. Marking notifications read refreshes notifications only. Uploads,
edits, reports, and moderation actions still refresh immediately. Query functions use GET and
never emit that event. Forms, drafts, dialogs, and write errors remain local
component state. Post activity and account loading are not migrated yet.
