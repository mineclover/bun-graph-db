# 📦 Database Backup & Restore Guide

**사용자를 위한 실무 가이드** - 백업이 필요할 때 직접 백업하고 복원하는 방법

> 💡 **이 문서는 누가 읽어야 하나요?**
> - ✅ 데이터베이스를 실제로 백업/복원해야 하는 사용자
> - ✅ 운영 중 백업 프로세스가 필요한 관리자
> - ✅ 백업 시나리오와 실제 사용법을 알고 싶은 개발자
>
> 📚 **기술적 설계가 궁금하신가요?**
> → [Backup Architecture 문서](../architecture/BACKUP_RESTORE_ARCHITECTURE.md) 참고

## 📋 Table of Contents

- [When to Backup](#-when-to-backup)
- [How to Backup](#-how-to-backup)
- [How to Restore](#-how-to-restore)
- [Backup Management](#-backup-management)
- [Common Scenarios](#-common-scenarios)
- [Best Practices](#-best-practices)
- [Troubleshooting](#-troubleshooting)
- [Automation (Optional)](#-automation-optional)

## ⏰ When to Backup

### Critical Times to Create Backups

You should **always** backup before:

1. **Major Updates or Migrations**
   - Upgrading the database schema
   - Performing bulk data operations
   - Installing major software updates

2. **Production Deployments**
   - Before deploying new features
   - Before changing critical configurations
   - Before server maintenance

3. **Risky Operations**
   - Running data cleanup scripts
   - Batch deleting nodes or relations
   - Testing new queries on production data

4. **Regular Maintenance**
   - End of day/week/month
   - Before long holidays or weekends
   - After significant data imports

### Warning Signs to Backup Immediately

- Database file growing rapidly
- Unusual system behavior or errors
- Planning to modify core data structures
- Before debugging production issues

## 💾 How to Backup

### Step-by-Step Backup Process

#### Step 1: Check Current Database Status

```bash
# Verify server is running
curl http://localhost:4141/graphql -H "Content-Type: application/json" \
  -d '{"query": "{ healthCheck { status } }"}'

# Check database size
ls -lh ./data/bun-graph-db.sqlite
```

#### Step 2: Create Backup

**Recommended Command** (Production):
```bash
bun run db:backup --compress --validate
```

**What happens**:
1. ✅ Database is validated
2. 📦 Full copy created using VACUUM INTO
3. 🗜️ Compressed with gzip (60-80% smaller)
4. 🔐 Checksum calculated for integrity
5. 📁 Saved to `./backups/database/db_YYYY-MM-DD_HH-MM-SS.sqlite.gz`

**Output**:
```
📦 Creating database backup...
✅ Backup completed successfully!
📁 Backup file: ./backups/database/db_2025-01-19_14-30-00.sqlite.gz
📊 Size: 3.21 MB (79% reduction)
⏱️  Duration: 312ms
🔐 Checksum: b7c4a9f2e1d3c8a5...

💡 Tip: Use --compress to reduce backup size
💡 Tip: Use --validate to ensure backup integrity
```

#### Step 3: Verify Backup Created

```bash
# List recent backups
bun run db:list-backups

# Verify specific backup exists
ls -lh ./backups/database/db_2025-01-19_14-30-00.sqlite.gz
```

#### Step 4: Record Backup Information

**Important to note**:
- ✅ Backup file path
- ✅ Database size before backup
- ✅ Timestamp
- ✅ Reason for backup (for future reference)

### Quick Backup Cheatsheet

| Scenario | Command | When to Use |
|----------|---------|-------------|
| **Standard Backup** | `bun run db:backup --compress --validate` | Most common use case |
| **Fast Backup** | `bun run db:backup --compress` | Quick backup without validation |
| **Uncompressed** | `bun run db:backup` | Very small databases |
| **Custom Location** | `bun run db:backup --output /path/to/backup.sqlite` | Specific storage location |

## 🔄 How to Restore

### When to Restore

Restore from backup when:
- ❌ Data corruption detected
- ❌ Accidental data deletion
- ❌ Failed migration needs rollback
- ❌ Testing went wrong on production
- 🔧 Moving to a different server
- 📋 Creating test environment from production data

### Step-by-Step Restore Process

#### ⚠️ CRITICAL WARNING
**Restoring will REPLACE your current database. All current data will be LOST.**

#### Step 1: Identify the Backup to Restore

```bash
# List all available backups
bun run db:list-backups
```

**Choose the right backup**:
- ✅ Most recent backup before the issue occurred
- ✅ Verify backup timestamp matches your needs
- ✅ Check backup size is reasonable

#### Step 2: Stop Application (Recommended)

```bash
# Stop your application to prevent data conflicts
# Example with systemd:
sudo systemctl stop bun-graph-db

# Or manually (Ctrl+C in the terminal running the server)
```

#### Step 3: Restore Database

**Recommended Command** (with safety):
```bash
bun run db:restore ./backups/database/db_2025-01-19_14-30-00.sqlite.gz
```

**What happens**:
1. 🔍 Validates backup file exists and is readable
2. 🛡️ Creates safety backup of current database
3. ✅ Validates backup integrity (if compressed, auto-decompresses)
4. 📁 Replaces current database with backup
5. 🔍 Verifies restored database

**Output**:
```
⚠️  WARNING: This will replace the current database!
📁 Restore from: ./backups/database/db_2025-01-19_14-30-00.sqlite.gz
🛡️  Creating safety backup of current database...
✅ Restore completed successfully!
📁 Restored to: ./data/bun-graph-db.sqlite
⏱️  Duration: 156ms

🛡️  Safety backup created: ./backups/database/safety_backup_2025-01-19.sqlite

🔍 Verification Results:
   - Tables: 25
   - Nodes: 10,543
   - Relations: 8,921
   - Checksum: ✅ Match

⚠️  IMPORTANT: Restart the server for changes to take effect
```

#### Step 4: Restart Application

```bash
# Restart your application
# Example with systemd:
sudo systemctl start bun-graph-db

# Or manually:
bun run dev
```

#### Step 5: Verify Restore

```bash
# Test database is working
curl http://localhost:4141/graphql -H "Content-Type: application/json" \
  -d '{"query": "{ healthCheck { status } }"}'

# Check data looks correct (example query)
curl http://localhost:4141/graphql -H "Content-Type: application/json" \
  -d '{"query": "{ tables { totalCount } }"}'
```

### Quick Restore Cheatsheet

| Scenario | Command | When to Use |
|----------|---------|-------------|
| **Safe Restore** | `bun run db:restore <backup-path>` | Standard restore with all safety checks |
| **Fast Restore** | `bun run db:restore <path> --no-verify` | Skip verification (faster but risky) |
| **Emergency Restore** | `bun run db:restore <path> --no-safety-backup` | No safety backup (NOT recommended) |

## 🎯 Common Scenarios

### Scenario 1: Before Production Deployment

**Situation**: You're about to deploy a major update to production.

**Process**:
```bash
# 1. Create pre-deployment backup
bun run db:backup --compress --validate \
  --output ./backups/pre-deployment-$(date +%Y%m%d).sqlite

# 2. Record backup details
echo "Pre-deployment backup: $(date)" >> ./backups/deployment-log.txt

# 3. Proceed with deployment
# ... deploy your changes ...

# 4. If deployment fails, restore immediately:
bun run db:restore ./backups/pre-deployment-20250119.sqlite.gz
sudo systemctl restart bun-graph-db
```

### Scenario 2: Accidental Data Deletion

**Situation**: Someone accidentally deleted important nodes or relations.

**Process**:
```bash
# 1. IMMEDIATELY stop making changes
# Don't modify the database further

# 2. List recent backups
bun run db:list-backups

# 3. Identify the last good backup (before deletion)
# Look for timestamp just before the incident

# 4. Stop the application
sudo systemctl stop bun-graph-db

# 5. Restore from backup
bun run db:restore ./backups/database/db_2025-01-19_13-00-00.sqlite.gz

# 6. Restart and verify
sudo systemctl start bun-graph-db

# 7. Verify data is restored
curl http://localhost:4141/graphql -H "Content-Type: application/json" \
  -d '{"query": "{ tables { totalCount } }"}'
```

### Scenario 3: Database Migration Testing

**Situation**: You want to test a schema migration without risking production data.

**Process**:
```bash
# 1. Create backup before migration
bun run db:backup --compress \
  --output ./backups/pre-migration-$(date +%Y%m%d).sqlite

# 2. Run your migration script
bun run migrate

# 3. If migration fails or has issues:
bun run db:restore ./backups/pre-migration-20250119.sqlite.gz

# 4. Fix migration script and try again
```

### Scenario 4: Creating Test Environment from Production

**Situation**: You need a test environment with production data.

**Process**:
```bash
# 1. On production server: Create backup
bun run db:backup --compress --output /tmp/prod-backup.sqlite

# 2. Copy backup to test server
scp /tmp/prod-backup.sqlite.gz test-server:/path/to/test/

# 3. On test server: Restore backup
bun run db:restore /path/to/test/prod-backup.sqlite.gz

# 4. Anonymize sensitive data (if needed)
# ... run data anonymization scripts ...
```

### Scenario 5: Regular End-of-Day Backup

**Situation**: You want to create daily backups for peace of mind.

**Process**:
```bash
# Create dated backup
bun run db:backup --compress --validate \
  --output ./backups/daily/backup-$(date +%Y%m%d).sqlite

# Verify it was created
bun run db:list-backups

# Keep only last 7 days
bun run db:cleanup --max-age-days 7
```

### Scenario 6: Server Migration

**Situation**: Moving database to a new server.

**Process**:
```bash
# OLD SERVER:
# 1. Create final backup
bun run db:backup --compress --validate \
  --output /tmp/migration-backup.sqlite

# 2. Copy to new server
scp /tmp/migration-backup.sqlite.gz new-server:/path/to/new/backups/

# NEW SERVER:
# 3. Install application
# 4. Restore database
bun run db:restore /path/to/new/backups/migration-backup.sqlite.gz

# 5. Start application
bun run dev

# 6. Verify everything works
curl http://localhost:4141/graphql -H "Content-Type: application/json" \
  -d '{"query": "{ healthCheck { status database } }"}'
```

### Scenario 7: Weekly Full Backup with Cleanup

**Situation**: Every Sunday, create a full backup and clean old ones.

**Process**:
```bash
#!/bin/bash
# weekly-backup.sh

# Create weekly backup
echo "Creating weekly backup..."
bun run db:backup --compress --validate \
  --output ./backups/weekly/backup-$(date +%Y-W%V).sqlite

# Keep only last 4 weeks
echo "Cleaning old backups..."
bun run db:cleanup --max-backups 4

# Show backup stats
echo "Backup statistics:"
bun run db:stats
```

Make executable and run:
```bash
chmod +x weekly-backup.sh
./weekly-backup.sh
```

## 📊 Managing Your Backups

### Viewing Your Backups

**See all your backups**:
```bash
bun run db:list-backups
```

This shows:
- ✅ All backup files with timestamps
- ✅ File sizes (compressed vs uncompressed)
- ✅ Total storage used
- ✅ Checksums for integrity verification

**Example output**:
```
📦 File-Level Backups:
────────────────────────────────────────────────────────────────────────────────
🗜️ ./backups/database/db_2025-01-19_14-30-00.sqlite.gz
   Size: 3.21 MB | Created: 1/19/2025, 2:30:00 PM

   ./backups/database/db_2025-01-18_14-00-00.sqlite
   Size: 15.42 MB | Created: 1/18/2025, 2:00:00 PM

📈 Summary: Total Backups: 2 | Total Size: 18.63 MB
```

### Checking Backup Health

**View backup statistics**:
```bash
bun run db:stats
```

This tells you:
- ✅ How many backups you've created
- ✅ Success rate of backups
- ✅ Last backup time
- ✅ Any recent failures

**Use this to**:
- Verify backups are running successfully
- Check when the last backup was created
- Monitor storage usage trends
- Identify any backup issues early

### Cleaning Up Old Backups

Over time, backups can use significant disk space. Clean them up regularly:

**Keep only last 10 backups**:
```bash
bun run db:cleanup --max-backups 10
```

**Delete backups older than 30 days**:
```bash
bun run db:cleanup --max-age-days 30
```

**Combined cleanup** (recommended):
```bash
bun run db:cleanup --max-backups 10 --max-age-days 30
```

**Preview what will be deleted** (safe to run):
```bash
bun run db:cleanup --max-backups 5 --dry-run
```

**When to clean up**:
- 💾 Running low on disk space
- 📅 Monthly maintenance routine
- 🧹 Before creating new backups
- 📊 Storage usage above 80%

## ✅ Best Practices

### Keep Multiple Backup Copies

**Why**: Protect against backup file corruption or loss

**How**:
```bash
# Keep backups in multiple locations
bun run db:backup --compress --output ./backups/local/
bun run db:backup --compress --output /mnt/external-drive/backups/

# Consider cloud storage for critical data
# (manually upload or use automation scripts)
```

**Recommended**:
- 3 copies total (original + 2 backups)
- 2 different storage types (local disk + external drive or cloud)
- 1 off-site location for disaster recovery

### Test Your Backups Regularly

**Why**: Ensure you can actually restore when needed

**How** (monthly recommended):
```bash
# 1. Pick a recent backup
bun run db:list-backups

# 2. Test restore to temporary location
DATABASE_PATH=./data/test-restore.sqlite \
  bun run db:restore ./backups/database/db_latest.sqlite.gz

# 3. Verify data looks correct
sqlite3 ./data/test-restore.sqlite "SELECT COUNT(*) FROM nodes;"

# 4. Clean up test file
rm ./data/test-restore.sqlite
```

**Important**: A backup you haven't tested is just a theory.

### Choose Right Backup Frequency

**Match frequency to your data change rate**:

| Your Situation | Backup Schedule | Keep For |
|----------------|-----------------|----------|
| Busy production system | Every few hours | 1 week |
| Active development | Daily | 2 weeks |
| Moderate usage | Daily | 1 month |
| Low activity | Weekly | 3 months |

**How to decide**:
- How much data can you afford to lose?
- How often does your data change?
- How much storage do you have?

### Monitor Disk Space

**Why**: Prevent backup failures due to full disk

**Quick check**:
```bash
# Check backup directory size
du -sh ./backups/

# Check available space
df -h .
```

**Action when space is low**:
```bash
# Clean up old backups
bun run db:cleanup --max-backups 10

# Or delete specific old backup manually
rm ./backups/database/db_2024-old.sqlite.gz
```

### Secure Your Backups

**For sensitive data**:
```bash
# Set proper file permissions
chmod 600 ./backups/*.sqlite
chown your-user:your-group ./backups/

# Consider encryption for highly sensitive data
gpg --encrypt --recipient your-email ./backups/db_backup.sqlite
```

**Access control**:
- Only authorized users should access backups
- Store off-site backups securely
- Use encryption for backups containing sensitive information

### Use Compression

**Always use `--compress` for production backups**:
```bash
bun run db:backup --compress --validate
```

**Benefits**:
- 60-80% smaller file size
- Faster transfers to remote storage
- Less disk space used
- Minimal performance impact

## 🔧 Troubleshooting

### Problem: Backup Takes Too Long

**Symptoms**: Backup duration >10 seconds for small databases

**Solutions**:
```bash
# 1. Check database size
ls -lh ./data/bun-graph-db.sqlite

# 2. Use compression (paradoxically faster for large files)
bun run db:backup --compress

# 3. Check disk I/O
iostat -x 1 5

# 4. Verify database integrity first
sqlite3 ./data/bun-graph-db.sqlite "PRAGMA integrity_check;"
```

### Problem: Restore Fails with "File Not Found"

**Symptoms**: `Backup file not found` error

**Solutions**:
```bash
# 1. Verify file exists
ls -l ./backups/database/db_2025-01-19.sqlite

# 2. Use absolute path
bun run db:restore /absolute/path/to/backup.sqlite

# 3. Check permissions
chmod 644 ./backups/database/*.sqlite
```

### Problem: Compressed Backup Cannot Be Restored

**Symptoms**: Decompression errors

**Solutions**:
```bash
# 1. Verify backup integrity
gunzip -t ./backups/db_backup.sqlite.gz

# 2. Manual decompression
gunzip ./backups/db_backup.sqlite.gz

# 3. Restore uncompressed file
bun run db:restore ./backups/db_backup.sqlite
```

### Problem: Database Locked During Backup

**Symptoms**: `database is locked` error

**Solutions**:
```bash
# 1. Close all database connections
# 2. Wait for ongoing transactions to complete
# 3. Use WAL mode (enabled by default in Bun SQLite)
# 4. Retry backup after a few seconds
```

### Problem: Out of Disk Space

**Symptoms**: Backup fails with disk space errors

**Solutions**:
```bash
# 1. Check available space
df -h .

# 2. Clean up old backups
bun run db:cleanup --max-backups 5

# 3. Use compression
bun run db:backup --compress

# 4. Move backups to external storage
mv ./backups/old-*.sqlite /mnt/external-drive/
```

### Problem: Backup File Corrupted

**Symptoms**: Restore fails with integrity errors

**Solutions**:
```bash
# 1. Verify checksum (if available)
sha256sum ./backups/db_backup.sqlite

# 2. Try previous backup
bun run db:list-backups
bun run db:restore ./backups/db_previous.sqlite

# 3. Validate backup before restore
bun run db:restore --validate-before ./backups/db_backup.sqlite
```

### Problem: Server Doesn't Reflect Restored Data

**Symptoms**: Data appears old after restore

**Solution**:
```bash
# Restart the server (required after restore)
# The database connection must be reopened to reflect changes

# If using systemd:
sudo systemctl restart bun-graph-db

# If using pm2:
pm2 restart bun-graph-db

# If running manually:
# Stop the server (Ctrl+C) and run:
bun run dev
```

## ⚙️ Automation (Optional)

> **Note**: This section covers automated backup scheduling. For most users, manual backups when needed (as described earlier in this guide) are sufficient.

If you need automated scheduled backups, here are common approaches:

### Linux/macOS: Cron Jobs

**Daily backup at 2 AM**:
```bash
# Edit crontab
crontab -e

# Add this line
0 2 * * * cd /path/to/bun-graph-db && bun run db:backup --compress --validate
```

**Weekly cleanup on Sundays**:
```bash
0 3 * * 0 cd /path/to/bun-graph-db && bun run db:cleanup --max-backups 10
```

### Windows: Task Scheduler

**Create backup script** (`backup-task.ps1`):
```powershell
cd C:\path\to\bun-graph-db
bun run db:backup --compress --validate
bun run db:cleanup --max-backups 10
```

**Schedule in Task Scheduler**:
1. Open Task Scheduler
2. Create Basic Task → "Database Backup"
3. Trigger: Daily at 2:00 AM
4. Action: Run program → `powershell.exe`
5. Arguments: `-File "C:\path\to\backup-task.ps1"`

### Linux: Systemd Timer

**Create service file** (`/etc/systemd/system/db-backup.service`):
```ini
[Unit]
Description=Database Backup

[Service]
Type=oneshot
User=your-user
WorkingDirectory=/path/to/bun-graph-db
ExecStart=/usr/bin/bun run db:backup --compress --validate
```

**Create timer file** (`/etc/systemd/system/db-backup.timer`):
```ini
[Unit]
Description=Daily Backup Timer

[Timer]
OnCalendar=daily
OnCalendar=02:00

[Install]
WantedBy=timers.target
```

**Enable**:
```bash
sudo systemctl enable db-backup.timer
sudo systemctl start db-backup.timer
```

### Advanced: GraphQL API

You can also trigger backups programmatically:

```graphql
mutation CreateBackup {
  backupDatabase(input: {
    compress: true
    validate: true
  }) {
    success
    backupPath
    sizeBytes
  }
}
```

See [Backup Architecture](../architecture/BACKUP_RESTORE_ARCHITECTURE.md) for complete GraphQL API documentation.

## 📚 Related Documentation

- [Backup Architecture](../architecture/BACKUP_RESTORE_ARCHITECTURE.md) - Technical design and implementation
- [Quick Start Guide](../../CLAUDE.md#quick-start) - Getting started with the database
- [GraphQL API Reference](../api/doc-api-reference.md) - Complete API documentation
- [Table Package Guide](./QUICK_START_IMPORT_EXPORT.md) - Table-level export/import

## 🆘 Getting Help

If you encounter issues not covered in this guide:

1. Check server logs: `tail -f /var/log/bun-graph-db.log`
2. Run health check: `bun run db:stats`
3. Verify database integrity: `sqlite3 ./data/bun-graph-db.sqlite "PRAGMA integrity_check;"`
4. Review backup metrics: `bun run db:stats`
5. Check disk space: `df -h .`

---

**Last Updated**: 2025-01-19
**Version**: 1.0.0
