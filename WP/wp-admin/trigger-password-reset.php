<?php
/**
 * ✉️ Custom Endpoint: Send Password Reset Email
 */
add_action('rest_api_init', function () {
    register_rest_route('custom/v1', '/send-reset-link', [
        'methods'  => 'POST',
        'callback' => 'lista_send_reset_link_rest',
        'permission_callback' => '__return_true',
    ]);
});

function lista_send_reset_link_rest(WP_REST_Request $request) {
    $params = $request->get_json_params();
    $email  = sanitize_email($params['email'] ?? '');

    if (empty($email)) {
        return new WP_REST_Response([
            'success' => false,
            'message' => 'Email is required.'
        ], 400);
    }

    $user = get_user_by('email', $email);
    if (!$user) {
        // Always respond the same (for security)
        return new WP_REST_Response([
            'success' => true,
            'message' => 'If an account exists for that email, a reset link will be sent.'
        ], 200);
    }

    // Generate the reset key
    $key = get_password_reset_key($user);

    if (is_wp_error($key)) {
        return new WP_REST_Response([
            'success' => false,
            'message' => 'Could not generate reset key.'
        ], 500);
    }

    // Build your custom frontend reset link
    $reset_link = 'https://next-lista.vercel.app/reset-password?key=' . rawurlencode($key) . '&login=' . rawurlencode($user->user_login);

    // Custom email subject and message
    $subject = 'Reset Your Password - Lista';
    $message = "Hi {$user->display_name},\n\n";
    $message .= "We received a request to reset your password.\n";
    $message .= "Click the link below to set a new password:\n\n";
    $message .= "$reset_link\n\n";
    $message .= "If you didn’t request this, please ignore this email.\n\n";
    $message .= "— The Lista Team";

    // Send email
    $sent = wp_mail($user->user_email, $subject, $message);

    if (!$sent) {
        return new WP_REST_Response([
            'success' => false,
            'message' => 'Failed to send reset email.'
        ], 500);
    }

    return new WP_REST_Response([
        'success' => true,
        'message' => 'If an account exists for that email, a reset link will be sent.'
    ], 200);
}
