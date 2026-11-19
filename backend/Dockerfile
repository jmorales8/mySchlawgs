FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY dotnet-tools.json ./
COPY backend/backend.csproj backend/
RUN dotnet restore backend/backend.csproj && dotnet tool restore

COPY backend/ backend/
RUN dotnet publish backend/backend.csproj -c Release --no-restore -o /out
# Build the migration tool without needing the live database or its secrets.
RUN ASPNETCORE_ENVIRONMENT=Development dotnet tool run dotnet-ef migrations bundle \
    --project backend/backend.csproj --configuration Release --no-build --output /out/efbundle

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /out/ ./

ENV ASPNETCORE_ENVIRONMENT=Production \
    ASPNETCORE_URLS=http://0.0.0.0:8080
EXPOSE 8080
USER $APP_UID
CMD ["dotnet", "backend.dll"]
