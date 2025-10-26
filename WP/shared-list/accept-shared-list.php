<?php
add_action('rest_api_init', function () {
    register_rest_route('custom/v1', '/accept-shared-list', [
        'methods' => 'POST',
        'callback' => 'accept_shared_list',
        'permission_callback' => function () {
            return is_user_logged_in();
        }
    ]);
});

function accept_shared_list(WP_REST_Request $request)
{
    $list_id = intval($request->get_param('list_id'));
    $user_id = intval($request->get_param('user_id'));
    $code = sanitize_text_field($request->get_param('code'));

    if (!$list_id || !$user_id || !$code) {
        return new WP_REST_Response([
            'success' => false,
            'message' => 'Missing parameters'
        ], 400);
    }

    // Authenticated user must match user_id
    $current_user = wp_get_current_user();
    if (!$current_user || intval($current_user->ID) !== $user_id) {
        return new WP_REST_Response([
            'success' => false,
            'message' => 'User mismatch'
        ], 403);
    }

    // If the requester is the list owner, do nothing (owners shouldn't be added to shared_with_users)
    $owner_id = get_field('owner_id', $list_id);
    if (intval($owner_id) === intval($user_id)) {
        return new WP_REST_Response([
            'success' => true,
            'message' => 'Owner already has access',
            'already_owner' => true,
        ], 200);
    }

    // If user is already shared, return success (allow old links to keep working)
    $shared_users = get_field('shared_with_users', $list_id, false);
    if (!is_array($shared_users)) { $shared_users = []; }
    $already_shared = in_array($user_id, array_map('intval', $shared_users), true);
    if ($already_shared) {
        return new WP_REST_Response([
            'success' => true,
            'message' => 'Already has access',
            'already_shared' => true,
        ], 200);
    }

    // Validate share code ONLY for users not yet shared
    $saved_code = get_field('share_code', $list_id);
    $expires_at = intval(get_field('share_code_expires', $list_id));

    if (!$saved_code || strtoupper($saved_code) !== strtoupper($code)) {
        return new WP_REST_Response([
            'success' => false,
            'message' => 'Invalid code'
        ], 403);
    }

    if ($expires_at && time() > $expires_at) {
        return new WP_REST_Response([
            'success' => false,
            'message' => 'Code expired'
        ], 410);
    }

    // Add user to shared_with_users (not already present as handled above)

    if (!in_array($user_id, $shared_users)) {
        $shared_users[] = $user_id;
        update_field('shared_with_users', $shared_users, $list_id);

        // Notify via Pusher (same schema as share-list.php)
        if (function_exists('setup_pusher')) {
            $pusher = setup_pusher();

            $owner_id = get_field('owner_id', $list_id);
            $new_user = get_user_by('id', $user_id);

            $eventData = array(
                'listId' => $list_id,
                'userId' => $user_id,
                'action' => 'add',
                'userName' => $new_user ? $new_user->display_name : '',
                'timestamp' => date('c')
            );

            // Send to list owner
            if ($owner_id) {
                $pusher->trigger('user-lists-' . $owner_id, 'share-update', $eventData);
            }

            // Send to all other shared users (excluding the new user)
            foreach ($shared_users as $shared_user_id) {
                if (intval($shared_user_id) !== intval($user_id)) {
                    $pusher->trigger('user-lists-' . $shared_user_id, 'share-update', $eventData);
                }
            }
        }
    }

    // Optional: rotate code after use (single-use). Comment out to allow reuse until expiry
    // update_field('share_code', null, $list_id);
    // update_field('share_code_expires', null, $list_id);

    return new WP_REST_Response([
        'success' => true,
        'message' => 'Access granted'
    ], 200);
}
