# Admin accounts

Create an admin using the backend's configured database from the repository root:

```powershell
dotnet run --project backend/backend.csproj -- --create-admin USERNAME
```

This local command creates a new account, prints a cryptographically random password once, and stores only its salted password hash. Save the password in your password manager. Existing usernames are rejected; this command does not overwrite or promote existing accounts. There is no public admin signup endpoint.

Sign in through the normal homepage login. Admins use the same community feed, with single-click **Remove post · Admin** and **Remove comment · Admin** controls. Post removal hides the post and its photos publicly, records the administrator and a removal reason, and keeps the post for moderation review and disputes. Comment removal deletes the comment; replies remain. The backend checks permissions on every removal request.

The profile menu also links to the moderation queue for reviewing reports and disputes.
