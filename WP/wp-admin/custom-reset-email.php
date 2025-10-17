<?php

/**
 * ✉️ Customize the "Reset Password" email content and subject
 */

 add_filter('retrieve_password_title', function($title, $user_login, $user_data) {
	return 'Reset your Lista password';
}, 10, 3);


add_filter('retrieve_password_message', function($message, $key, $user_login, $user_data) {
    // Build your custom password reset URL
    $reset_url = "https://next-lista.vercel.app/reset-password?key=$key&login=" . rawurlencode($user_login);

    // Custom email message
    $custom_message = "Hi " . $user_data->display_name . ",\n\n";
    $custom_message .= "We received a request to reset your password for your Lista account.\n\n";
    $custom_message .= "You can reset your password by clicking the link below:\n";
    $custom_message .= $reset_url . "\n\n";
    $custom_message .= "If you did not request this change, you can safely ignore this email.\n\n";
    $custom_message .= "Thanks,\n";
    $custom_message .= "The Lista Team";

    return $custom_message;
}, 10, 4);
