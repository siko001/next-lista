<?php
/**
 * WordPress Custom Endpoint for Google OAuth Authentication
 * 
 * Add this code to your WordPress theme's functions.php or create a custom plugin
 * This endpoint handles Google OAuth users and returns a JWT token
 */

// Register the custom REST API endpoints
add_action('rest_api_init', function () {
    register_rest_route('custom/v1', '/google-auth', array(
        'methods' => 'POST',
        'callback' => 'handle_google_auth',
        'permission_callback' => '__return_true', // Allow public access
    ));
    
    register_rest_route('custom/v1', '/link-google-account', array(
        'methods' => 'POST',
        'callback' => 'handle_link_google_account',
        'permission_callback' => '__return_true', // Allow public access
    ));
});

/**
 * Handle Google OAuth authentication
 * Creates or authenticates a user and returns a JWT token
 */
function handle_google_auth($request) {
    $params = $request->get_json_params();
    
    // Validate required fields
    if (empty($params['email']) || empty($params['google_id'])) {
        return new WP_Error(
            'missing_fields',
            'Email and Google ID are required',
            array('status' => 400)
        );
    }
    
    $email = sanitize_email($params['email']);
    $google_id = sanitize_text_field($params['google_id']);
    $name = isset($params['name']) ? sanitize_text_field($params['name']) : '';
    $picture = isset($params['picture']) ? esc_url_raw($params['picture']) : '';
    
    // Check if user exists by email
    $user = get_user_by('email', $email);
    
    if (!$user) {
        // Create a new user
        $username = sanitize_user(explode('@', $email)[0]);
        
        // Make username unique if it already exists
        $base_username = $username;
        $counter = 1;
        while (username_exists($username)) {
            $username = $base_username . $counter;
            $counter++;
        }
        
        // Generate a random password (user won't use it, they'll login via Google)
        $password = wp_generate_password(20, true, true);
        
        $user_id = wp_create_user($username, $password, $email);
        
        if (is_wp_error($user_id)) {
            return new WP_Error(
                'user_creation_failed',
                $user_id->get_error_message(),
                array('status' => 500)
            );
        }
        
        // Update user meta
        wp_update_user(array(
            'ID' => $user_id,
            'display_name' => $name,
            'first_name' => $name,
        ));
        
        // Store Google ID in user meta
        update_user_meta($user_id, 'google_id', $google_id);
        
        if ($picture) {
            update_user_meta($user_id, 'google_picture', $picture);
        }
        
        $user = get_user_by('id', $user_id);
    } else {
        // User exists, update Google ID if not set
        $existing_google_id = get_user_meta($user->ID, 'google_id', true);
        
        if (empty($existing_google_id)) {
            update_user_meta($user->ID, 'google_id', $google_id);
        }
        
        // Update picture if provided
        if ($picture) {
            update_user_meta($user->ID, 'google_picture', $picture);
        }
    }
    
    // Generate JWT token
    // Make sure you have the JWT Authentication plugin installed
    // https://wordpress.org/plugins/jwt-authentication-for-wp-rest-api/
    
    $secret_key = defined('JWT_AUTH_SECRET_KEY') ? JWT_AUTH_SECRET_KEY : 'your-secret-key';
    $issued_at = time();
    $not_before = $issued_at;
    $expire = $issued_at + (60 * 60 * 24 * 7); // Token valid for 7 days
    
    $token_data = array(
        'iss' => get_bloginfo('url'),
        'iat' => $issued_at,
        'nbf' => $not_before,
        'exp' => $expire,
        'data' => array(
            'user' => array(
                'id' => $user->ID,
            )
        )
    );
    
    // Use the JWT library to encode the token
    // If you're using the JWT Authentication plugin, use its method
    if (class_exists('Firebase\JWT\JWT')) {
        $token = Firebase\JWT\JWT::encode($token_data, $secret_key, 'HS256');
    } else {
        // Fallback: return a simple token (you should use proper JWT library)
        return new WP_Error(
            'jwt_not_available',
            'JWT library not found. Please install JWT Authentication plugin.',
            array('status' => 500)
        );
    }
    
    // Return the token and user data
    return new WP_REST_Response(array(
        'token' => $token,
        'user' => array(
            'id' => $user->ID,
            'email' => $user->user_email,
            'name' => $user->display_name,
            'username' => $user->user_login,
            'picture' => get_user_meta($user->ID, 'google_picture', true),
        ),
    ), 200);
}

/**
 * Handle linking Google account to existing temporary user
 * Updates the temporary user with Google information and returns a JWT token
 */
function handle_link_google_account($request) {
    $params = $request->get_json_params();
    
    $google_email = isset($params['google_email']) ? sanitize_email($params['google_email']) : '';
    $google_name = isset($params['google_name']) ? sanitize_text_field($params['google_name']) : '';
    $google_id = isset($params['google_id']) ? sanitize_text_field($params['google_id']) : '';
    $google_picture = isset($params['google_picture']) ? esc_url_raw($params['google_picture']) : '';
    $temp_user_id = isset($params['temp_user_id']) ? intval($params['temp_user_id']) : 0;
    
    if (empty($google_email)) {
        return new WP_Error('missing_email', 'Google email is required', array('status' => 400));
    }
    
    $user = null;
    
    // If temp_user_id is provided, try to get that user
    if ($temp_user_id > 0) {
        $temp_user = get_user_by('id', $temp_user_id);
        
        if ($temp_user) {
            // Update the temporary user with Google information
            wp_update_user(array(
                'ID' => $temp_user->ID,
                'user_email' => $google_email,
                'display_name' => $google_name,
                'first_name' => $google_name,
            ));
            
            // Store Google ID and picture
            update_user_meta($temp_user->ID, 'google_id', $google_id);
            if ($google_picture) {
                update_user_meta($temp_user->ID, 'google_picture', $google_picture);
            }
            
            // Mark as registered
            update_user_meta($temp_user->ID, 'registered', 'yes');
            
            $user = get_user_by('id', $temp_user->ID);
        }
    }
    
    // If no temp user found, check if user exists by email
    if (!$user) {
        $user = get_user_by('email', $google_email);
        
        if ($user) {
            // User exists, just update Google info
            update_user_meta($user->ID, 'google_id', $google_id);
            if ($google_picture) {
                update_user_meta($user->ID, 'google_picture', $google_picture);
            }
        }
    }
    
    // If still no user, create a new one
    if (!$user) {
        $username = sanitize_user(explode('@', $google_email)[0]);
        $base_username = $username;
        $counter = 1;
        while (username_exists($username)) {
            $username = $base_username . $counter;
            $counter++;
        }
        
        $password = wp_generate_password(20, true, true);
        $user_id = wp_create_user($username, $password, $google_email);
        
        if (is_wp_error($user_id)) {
            return new WP_Error('user_creation_failed', $user_id->get_error_message(), array('status' => 500));
        }
        
        wp_update_user(array(
            'ID' => $user_id,
            'display_name' => $google_name,
            'first_name' => $google_name,
        ));
        
        update_user_meta($user_id, 'google_id', $google_id);
        if ($google_picture) {
            update_user_meta($user_id, 'google_picture', $google_picture);
        }
        update_user_meta($user_id, 'registered', 'yes');
        
        $user = get_user_by('id', $user_id);
    }
    
    // Generate JWT token
    $secret_key = defined('JWT_AUTH_SECRET_KEY') ? JWT_AUTH_SECRET_KEY : 'your-secret-key';
    $issued_at = time();
    $not_before = $issued_at;
    $expire = $issued_at + (60 * 60 * 24 * 7); // Token valid for 7 days
    
    $token_data = array(
        'iss' => get_bloginfo('url'),
        'iat' => $issued_at,
        'nbf' => $not_before,
        'exp' => $expire,
        'data' => array(
            'user' => array(
                'id' => $user->ID,
            )
        )
    );
    
    if (class_exists('Firebase\JWT\JWT')) {
        $token = Firebase\JWT\JWT::encode($token_data, $secret_key, 'HS256');
    } else {
        return new WP_Error('jwt_not_available', 'JWT library not found', array('status' => 500));
    }
    
    return new WP_REST_Response(array(
        'token' => $token,
        'user' => array(
            'id' => $user->ID,
            'email' => $user->user_email,
            'name' => $user->display_name,
            'username' => $user->user_login,
            'picture' => get_user_meta($user->ID, 'google_picture', true),
        ),
    ), 200);
}

/**
 * Add CORS headers to allow requests from your Next.js app
 */
add_action('rest_api_init', function() {
    remove_filter('rest_pre_serve_request', 'rest_send_cors_headers');
    add_filter('rest_pre_serve_request', function($value) {
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Methods: POST, GET, OPTIONS, PUT, DELETE');
        header('Access-Control-Allow-Credentials: true');
        header('Access-Control-Allow-Headers: Content-Type, Authorization');
        return $value;
    });
}, 15);
