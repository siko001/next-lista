<?php
/**
 * 🔄 Redirect all front-end pages to Next.js frontend
 * except admin, login, API, and cron routes
 */

add_action('template_redirect', function() {

    // Allow backend and essential routes
    if (
        is_admin() ||
        defined('REST_REQUEST') && REST_REQUEST ||
        defined('DOING_CRON') && DOING_CRON ||
        (isset($_SERVER['REQUEST_URI']) && (
            strpos($_SERVER['REQUEST_URI'], 'wp-login.php') !== false ||
            strpos($_SERVER['REQUEST_URI'], 'wp-json') !== false
        ))
    ) {
        return; // ✅ Don't redirect backend, REST API, or login
    }

    // Your frontend (Next.js) domain
    $frontend_base = 'https://next-lista.vercel.app';

    // Get the current requested path (e.g., /about, /contact)
    $path = $_SERVER['REQUEST_URI'];
    $redirect_url = rtrim($frontend_base, '/') . $path;

    // Do a 301 redirect (permanent)
    wp_redirect($redirect_url, 301);
    exit;
});
