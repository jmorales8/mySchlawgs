using System.Threading.Channels;
using Backend.Data;
using Microsoft.EntityFrameworkCore;

namespace Backend.Services;

// Delivery runs outside the request so account existence is not exposed through SMTP timing.
// This bounded, development-friendly queue is in memory; deploy a durable outbox if guaranteed delivery is required.
public sealed class PasswordResetDelivery(IServiceScopeFactory scopes, ILogger<PasswordResetDelivery> logger) : BackgroundService
{
    public sealed record Mail(Guid UserId, string Email, string Token, bool Changed = false);
    private readonly Channel<Mail> queue = Channel.CreateBounded<Mail>(new BoundedChannelOptions(100) { SingleReader = true, FullMode = BoundedChannelFullMode.Wait });

    public void Enqueue(Mail mail)
    {
        if (!queue.Writer.TryWrite(mail)) logger.LogWarning("Password recovery delivery queue is full.");
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var mail in queue.Reader.ReadAllAsync(stoppingToken)) {
            try {
                using var scope = scopes.CreateScope();
                var sender = scope.ServiceProvider.GetRequiredService<VerificationEmail>();
                if (!sender.Enabled) continue;
                if (mail.Changed) await sender.SendPasswordChanged(mail.UserId, mail.Email, mail.Token, stoppingToken);
                else {
                    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                    var hash = VerificationEmail.Hash(mail.Token);
                    if (await db.Users.AnyAsync(x => x.Id == mail.UserId && x.Email == mail.Email && x.PasswordResetHash == hash && x.PasswordResetExpiresAt > DateTimeOffset.UtcNow, stoppingToken))
                        await sender.SendReset(mail.UserId, mail.Email, mail.Token, stoppingToken);
                }
            } catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex) {
                // Don't log request contents, addresses, credentials, or tokens.
                logger.LogWarning("Password recovery email delivery failed ({ErrorType}).", ex.GetType().Name);
            }
        }
    }
}
