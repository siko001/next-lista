<?php
add_action('rest_api_init', function () {
    register_rest_route('custom/v1', '/generate-share-code', [
        'methods' => 'POST',
        'callback' => 'generate_share_code',
        'permission_callback' => function () {
            return is_user_logged_in();
        }
    ]);
});

function generate_share_code(WP_REST_Request $request)
{
    $list_id = intval($request->get_param('list_id'));
    if (!$list_id) {
        return new WP_REST_Response([
            'success' => false,
            'message' => 'Missing list_id'
        ], 400);
    }

    // Ensure current user is authorized: owner or already shared user
    $current_user = wp_get_current_user();
    $owner_id = get_field('owner_id', $list_id);
    $shared_users = get_field('shared_with_users', $list_id, false);
    if (!is_array($shared_users)) { $shared_users = []; }

    $is_owner = ($current_user && intval($owner_id) === intval($current_user->ID));
    $is_shared_user = in_array(intval($current_user->ID), array_map('intval', $shared_users), true);

    if (!$current_user || (!$is_owner && !$is_shared_user)) {
        return new WP_REST_Response([
            'success' => false,
            'message' => 'Not authorized to generate code for this list'
        ], 403);
    }

    // Generate an 8-char share code
    $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
    $code = '';
    for ($i = 0; $i < 8; $i++) {
        $code .= $alphabet[random_int(0, strlen($alphabet) - 1)];
    }

    // Optional expiry (48 hours)
    $expires_at = time() + 48 * 60 * 60;

    // Store in post meta/ACF
    update_field('share_code', $code, $list_id);
    update_field('share_code_expires', $expires_at, $list_id);

    return new WP_REST_Response([
        'success' => true,
        'code' => $code,
        'expires_at' => $expires_at,
    ], 200);
}
