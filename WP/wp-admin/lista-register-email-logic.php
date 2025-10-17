<?php
/**
 * Custom REST endpoints and user email logic for Lista
 */

/**
 * ----------------------------------------------------------------
 * 1️⃣ Custom REST endpoint: trigger-user-update
 * ----------------------------------------------------------------
 * Called from the frontend to mark a user as "registered"
 * and send the "Welcome to Lista" email.
 */
add_action('rest_api_init', function () {
    register_rest_route('custom/v1', '/trigger-user-update', array(
        'methods'  => 'POST',
        'callback' => 'trigger_user_update_rest',
        'permission_callback' => function () {
            return current_user_can('edit_users');
        },
    ));
});

function trigger_user_update_rest(WP_REST_Request $request) {
    $user_id = $request->get_param('user_id');

    if (!$user_id || !get_userdata($user_id)) {
        return new WP_Error('invalid_user', 'Invalid user ID.', ['status' => 400]);
    }

    // Trigger custom update event (sends welcome email)
    do_action('custom_user_update', $user_id);

    return rest_ensure_response(['message' => 'User update process triggered successfully.']);
}


/**
 * ----------------------------------------------------------------
 * 2️⃣ Prevent welcome email during password reset
 * ----------------------------------------------------------------
 * Use both profile_update hook AND password_reset flag
 */
add_action('profile_update', 'trigger_custom_user_update_hook', 10, 2);

function trigger_custom_user_update_hook($user_id, $old_user_data) {
    $user = get_userdata($user_id);

    // 🚫 Stop if password was changed (prevents welcome email on reset)
    if (!empty($old_user_data->user_pass) && $old_user_data->user_pass !== $user->user_pass) {
        update_user_meta($user_id, 'skip_custom_user_update_email', true);
        return;
    }

    do_action('custom_user_update', $user_id);
}

// Also hook into password reset process
add_action('password_reset', function($user) {
    update_user_meta($user->ID, 'skip_custom_user_update_email', true);
});


/**
 * ----------------------------------------------------------------
 * 3️⃣ Handle the custom user update: send welcome email + set meta
 * ----------------------------------------------------------------
 */
function handle_custom_user_update($user_id) {
	global $lista_sending_reset;
    $user = get_userdata($user_id);
    if (!$user) {
        return;
    }
	
	 // 🚫 Skip welcome email if we're in a reset process
    if (!empty($lista_sending_reset)) {
        return;
    }


    // 🚫 Skip email if flagged (e.g. from password reset)
    if (get_user_meta($user_id, 'skip_custom_user_update_email', true)) {
        delete_user_meta($user_id, 'skip_custom_user_update_email'); // clean up
        return;
    }

    // Update the "registered" state to "yes"
    update_user_meta($user_id, 'registered', "yes");

    // Send notification email
    $email   = $user->user_email;
    $subject = "Welcome to Lista";
    $message = "Hello and welcome to Lista " . $user->display_name . ",\n\n"
             . "Please use your chosen username and password to login next time when needed, "
             . "you will never lose your lists again.\n\n"
             . "Thank you for using Lista :)";

    wp_mail($email, $subject, $message);
}
add_action('custom_user_update', 'handle_custom_user_update');


/**
 * ----------------------------------------------------------------
 * 4️⃣ Customize WordPress outgoing email headers
 * ----------------------------------------------------------------
 */
add_filter('wp_mail_from_name', function ($name) {
    return 'Lista'; // Sender name
});

add_filter('wp_mail_from', function ($email) {
    return 'no-reply@lista.vercel.app'; // Sender address
});


/**
 * ----------------------------------------------------------------
 * 5️⃣ REST endpoint: check-email
 * ----------------------------------------------------------------
 * Returns whether a given email already exists in WP users.
 */
add_action('rest_api_init', function () {
    register_rest_route('custom-api/v1', '/check-email', array(
        'methods'  => 'GET',
        'callback' => 'check_email_exists',
        'args' => array(
            'email' => array(
                'required'          => true,
                'sanitize_callback' => 'sanitize_email',
            ),
        ),
    ));
});

function check_email_exists(WP_REST_Request $request) {
    $email = $request->get_param('email');
    $user  = get_user_by('email', $email);

    if ($user) {
        return new WP_REST_Response(['exists' => true], 200);
    } else {
        return new WP_REST_Response(['exists' => false], 200);
    }
}


/**
 * ----------------------------------------------------------------
 * 6️⃣ JWT Auth: Add extra user data to token response
 * ----------------------------------------------------------------
 */
add_filter('jwt_auth_token_before_dispatch', 'add_user_id_to_jwt_response', 10, 2);
function add_user_id_to_jwt_response($data, $user) {
    $data['user_id']           = $user->ID;
    $data['user_email']        = $user->user_email;
    $data['user_display_name'] = $user->display_name;
    return $data;
}
