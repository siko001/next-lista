<?php

add_action('init', function() {
    // Allow REST API and CLI for headless
    if (defined('REST_REQUEST') && REST_REQUEST) return;
    if (defined('WP_CLI') && WP_CLI) return;

    // Check if we're on admin area or wp-login.php only
    if (is_admin() || (isset($_SERVER['REQUEST_URI']) && strpos($_SERVER['REQUEST_URI'], 'wp-login.php') !== false)) {
        // If user is logged in but not allowed → log them out immediately
        if (is_user_logged_in()) {
            $current_user = wp_get_current_user();

            if ($current_user && strtolower($current_user->user_email) !== 'neil.mallia1@gmail.com') {
                wp_logout();

                // Redirect external URL using header to avoid WP intercept
                header('Location: https://next-lista.vercel.app');
                exit;
            }
        }
    }

    // Deny login attempts on wp-login.php unless allowed email
    $is_login_request = isset($_SERVER['REQUEST_URI']) && strpos($_SERVER['REQUEST_URI'], 'wp-login.php') !== false;

    if ($is_login_request && !empty($_POST['log'])) {
        $username = sanitize_text_field($_POST['log']);
        $user     = get_user_by('login', $username);

        if (!$user) {
            $user = get_user_by('email', $username);
        }

        // Deny login unless email matches
        if (!$user || strtolower($user->user_email) !== 'neil.mallia1@gmail.com') {
            wp_die(
                __('Login restricted. Only the administrator can access this site.'),
                __('Access Denied'),
                ['response' => 403]
            );
        }
    }
});

add_filter('login_errors', function($errors) {
    return __('ERROR: Incorrect username or password.');
});
