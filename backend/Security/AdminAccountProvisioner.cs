using System.Security.Cryptography;
using System.Text.RegularExpressions;
using Backend.Data;
using Backend.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Backend.Security;

public static class AdminAccountProvisioner
{
    public static async Task CreateAsync(IConfiguration configuration, string username)
    {
        if (!Regex.IsMatch(username, "^[a-zA-Z0-9_]{3,30}$"))
            throw new ArgumentException("Use a 3–30 character username containing letters, numbers, or underscores.");
        var options = new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(
            configuration.GetConnectionString("Postgres")
            ?? throw new InvalidOperationException("Connection string 'Postgres' is missing.")).Options;
        await using var db = new AppDbContext(options);
        if (await db.Users.AnyAsync(user => user.NormalizedUsername == username.ToUpperInvariant()))
            throw new InvalidOperationException("That username already exists. Choose a new admin username.");
        var password = Convert.ToBase64String(RandomNumberGenerator.GetBytes(24));
        var user = new AppUser {
            Id = Guid.NewGuid(), Username = username, NormalizedUsername = username.ToUpperInvariant(),
            IsAdmin = true, PasswordHash = ""
        };
        user.PasswordHash = new PasswordHasher<AppUser>().HashPassword(user, password);
        db.Users.Add(user);
        await db.SaveChangesAsync();
        Console.WriteLine($"Admin account created.\nUsername: {username}\nPassword: {password}");
    }
}
