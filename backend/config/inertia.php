<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Server Side Rendering
    |--------------------------------------------------------------------------
    */
    'ssr' => [
        'enabled' => false,
    ],

    /*
    |--------------------------------------------------------------------------
    | Pages
    |--------------------------------------------------------------------------
    |
    | In a decoupled architecture, frontend pages live in the frontend directory.
    | Paths are configured to locate pages in the decoupled frontend if needed.
    |
    */
    'pages' => [
        'ensure_pages_exist' => false,

        'paths' => [
            base_path('../frontend/resources/js/Pages'),
            resource_path('js/Pages'),
        ],

        'extensions' => [
            'js',
            'jsx',
            'svelte',
            'ts',
            'tsx',
            'vue',
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Testing
    |--------------------------------------------------------------------------
    |
    | When testing the decoupled backend, component existence checks are disabled
    | so the backend remains completely headless without requiring frontend bundles.
    |
    */
    'testing' => [
        'ensure_pages_exist' => false,
    ],

];
