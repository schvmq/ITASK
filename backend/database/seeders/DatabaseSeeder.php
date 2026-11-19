<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $password = Hash::make('password');

        // 1. System Administrator
        User::updateOrCreate(
            ['email' => 'admin@carsu.edu.ph'],
            [
                'name' => 'ITASK Administrator',
                'password' => $password,
                'email_verified_at' => now(),
                'is_admin' => true,
            ]
        );

        // 2. 19 Verified Faculty & Student Users (General system peer accounts)
        $users = [
            ['name' => 'Bryan Jay Oja', 'email' => 'bryanjay.oja@carsu.edu.ph'],
            ['name' => 'Juan Dela Cruz', 'email' => 'juan.delacruz@carsu.edu.ph'],
            ['name' => 'Maria Santos', 'email' => 'maria.santos@carsu.edu.ph'],
            ['name' => 'Mark Anthony Reyes', 'email' => 'mark.reyes@carsu.edu.ph'],
            ['name' => 'Angelica Flores', 'email' => 'angelica.flores@carsu.edu.ph'],
            ['name' => 'Christian Bautista', 'email' => 'christian.bautista@carsu.edu.ph'],
            ['name' => 'Bea Alonzo', 'email' => 'bea.alonzo@carsu.edu.ph'],
            ['name' => 'John Paul Garcia', 'email' => 'john.garcia@carsu.edu.ph'],
            ['name' => 'Claire Mendoza', 'email' => 'claire.mendoza@carsu.edu.ph'],
            ['name' => 'Paolo Torres', 'email' => 'paolo.torres@carsu.edu.ph'],
            ['name' => 'Dianne Ramos', 'email' => 'dianne.ramos@carsu.edu.ph'],
            ['name' => 'Kenneth Navarro', 'email' => 'kenneth.navarro@carsu.edu.ph'],
            ['name' => 'Alyssa Valdez', 'email' => 'alyssa.valdez@carsu.edu.ph'],
            ['name' => 'Gabriel Castillo', 'email' => 'gabriel.castillo@carsu.edu.ph'],
            ['name' => 'Patricia Aquino', 'email' => 'patricia.aquino@carsu.edu.ph'],
            ['name' => 'Miguel Villanueva', 'email' => 'miguel.villanueva@carsu.edu.ph'],
            ['name' => 'Joshua Tan', 'email' => 'joshua.tan@carsu.edu.ph'],
            ['name' => 'Sarah Geronimo', 'email' => 'sarah.geronimo@carsu.edu.ph'],
            ['name' => 'Carlos Yulo', 'email' => 'carlos.yulo@carsu.edu.ph'],
        ];

        foreach ($users as $userData) {
            User::updateOrCreate(
                ['email' => $userData['email']],
                [
                    'name' => $userData['name'],
                    'password' => $password,
                    'email_verified_at' => now(),
                    'is_admin' => false,
                ]
            );
        }
    }
}
