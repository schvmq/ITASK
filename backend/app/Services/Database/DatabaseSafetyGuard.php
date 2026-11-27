<?php

namespace App\Services\Database;

use Illuminate\Console\Events\CommandStarting;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use RuntimeException;

class DatabaseSafetyGuard
{
    /**
     * List of destructive artisan command names that wipe or truncate tables.
     */
    protected const DESTRUCTIVE_COMMANDS = [
        'migrate:fresh',
        'migrate:reset',
        'migrate:refresh',
        'db:wipe',
    ];

    /**
     * Strict allowlist of authorized testing databases.
     * Wildcards and suffix patterns are intentionally disallowed to prevent false positives.
     */
    protected const ALLOWED_TEST_DATABASES = [
        'itask_testing',
    ];

    /**
     * Register fail-closed database guards for destructive operations.
     */
    public static function enforce(): void
    {
        Event::listen(CommandStarting::class, function (CommandStarting $event) {
            $command = $event->command;

            if (!in_array($command, self::DESTRUCTIVE_COMMANDS, true)) {
                return;
            }

            // Inspect explicit --database override from artisan input if provided
            $connectionName = null;
            if ($event->input && $event->input->hasOption('database')) {
                $connectionName = $event->input->getOption('database');
            }

            self::assertAuthorizedTestingDatabase($command, $connectionName);
        });
    }

    /**
     * Validate that the target database connection resolves strictly to an allowlisted test database.
     * Throws a RuntimeException immediately before any destructive operation can occur.
     */
    public static function assertAuthorizedTestingDatabase(string $operationName = 'destructive operation', ?string $connectionName = null): void
    {
        try {
            $connection = DB::connection($connectionName);
            $resolvedDatabase = $connection->getDatabaseName();
        } catch (\Throwable $e) {
            throw new RuntimeException(
                "[DATABASE SAFETY GUARD]: Failed to resolve active database connection before executing {$operationName}: " . $e->getMessage()
            );
        }

        $isAuthorized = in_array($resolvedDatabase, self::ALLOWED_TEST_DATABASES, true);

        if (!$isAuthorized) {
            $connLabel = $connectionName ? " (connection: '{$connectionName}')" : '';
            throw new RuntimeException(
                "[DATABASE SAFETY GUARD BLOCKED]: Execution of '{$operationName}' was aborted! " .
                "Target database '{$resolvedDatabase}'{$connLabel} is a protected development or production database. " .
                "Destructive operations (migrate:fresh, db:wipe, etc.) are strictly restricted to explicitly allowlisted testing databases (" . implode(', ', self::ALLOWED_TEST_DATABASES) . ")."
            );
        }
    }
}
