<?php
/**
 * 🔐 Custom Reset Password Endpoint for Lista Frontend
 */
add_action('rest_api_init', function () {
    register_rest_route('custom/v1', '/reset-password', [
        'methods'  => 'POST',
        'callback' => 'lista_reset_password_rest',
        'permission_callback' => '__return_true', 
    ]);
});

function lista_reset_password_rest(WP_REST_Request $request) {
    $params = $request->get_json_params();

    $key    = sanitize_text_field($params['key'] ?? '');
    $login  = sanitize_text_field($params['login'] ?? '');
    $new_pw = sanitize_text_field($params['password'] ?? '');

    if (empty($key) || empty($login) || empty($new_pw)) {
        return new WP_REST_Response([
            'success' => false,
            'message' => 'Missing reset parameters.'
        ], 400);
    }

    $user = get_user_by('login', $login);
    if (!$user) {
        $user = get_user_by('email', $login);
    }
    if (!$user) {
        return new WP_REST_Response([
            'success' => false,
            'message' => 'Invalid user.'
        ], 400);
    }

    // Verify reset key
    $check = check_password_reset_key($key, $user->user_login);
    if (is_wp_error($check)) {
        return new WP_REST_Response([
            'success' => false,
            'message' => 'Invalid or expired reset link.'
        ], 400);
    }

    // Reset the password
    reset_password($user, $new_pw);

    return new WP_REST_Response([
        'success' => true,
        'message' => 'Password changed successfully.'
    ], 200);
}
