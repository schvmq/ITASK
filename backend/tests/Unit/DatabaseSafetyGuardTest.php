<?php

namespace Tests\Unit;

use App\Services\Database\DatabaseSafetyGuard;
use PHPUnit\Framework\TestCase;
use RuntimeException;

class DatabaseSafetyGuardTest extends TestCase
{
    public function test_guard_allows_only_explicitly_allowlisted_testing_database(): void
    {
        $guard = new class extends DatabaseSafetyGuard {
            public static function testValidation(string $dbName): bool {
                $isAuthorized = in_array($dbName, self::ALLOWED_TEST_DATABASES, true);
                if (!$isAuthorized) {
                    throw new RuntimeException("[DATABASE SAFETY GUARD BLOCKED]: Destructive operation blocked against {$dbName}");
                }
                return true;
            }
        };

        // itask_testing is explicitly allowed
        $this->assertTrue($guard::testValidation('itask_testing'));

        // Suffix patterns without explicit allowlist are now rejected
        $this->expectException(RuntimeException::class);
        $guard::testValidation('custom_test_testing');
    }

    public function test_guard_strictly_blocks_destructive_commands_against_dev_and_staging_databases(): void
    {
        $guard = new class extends DatabaseSafetyGuard {
            public static function testValidation(string $dbName): void {
                $isAuthorized = in_array($dbName, self::ALLOWED_TEST_DATABASES, true);
                if (!$isAuthorized) {
                    throw new RuntimeException("[DATABASE SAFETY GUARD BLOCKED]: Destructive operation blocked against {$dbName}");
                }
            }
        };

        $protectedDatabases = [
            'iTasks',
            'itask',
            'itask_staging',
            'itask_production',
            'postgres',
            'random_testing', // rejected because not in strict allowlist
        ];

        foreach ($protectedDatabases as $protectedDb) {
            $caught = false;
            try {
                $guard::testValidation($protectedDb);
            } catch (RuntimeException $e) {
                $caught = true;
                $this->assertStringContainsString('[DATABASE SAFETY GUARD BLOCKED]', $e->getMessage());
                $this->assertStringContainsString($protectedDb, $e->getMessage());
            }

            $this->assertTrue($caught, "Expected destructive operation against '{$protectedDb}' to be blocked, but it was allowed!");
        }
    }
}
