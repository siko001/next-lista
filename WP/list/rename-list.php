<?php

add_action('post_updated', function($post_id, $post_after, $post_before) {
    if ($post_after->post_type !== 'shopping-list') return;
    if (in_array($post_after->post_status, ['trash', 'auto-draft'], true)) return;
    // Reordering updates menu_order through wp_update_post. Only a changed title
    // is a rename and should be sent to the owner or shared users.
    if ($post_before->post_title === $post_after->post_title) return;


    // Get owner and shared users (reuse your robust logic)
    $owner_id = intval(get_field('owner_id', $post_id));
    $shared_with_users = get_field('shared_with_users', $post_id) ?: [];
    if (!is_array($shared_with_users)) {
        $shared_with_users = [$shared_with_users];
    }
    $shared_with_users = array_map(function($user) {
        if (is_array($user) && isset($user['ID'])) return intval($user['ID']);
        return intval($user);
    }, $shared_with_users);

    $user_ids = array_unique(array_filter(array_merge([$owner_id], $shared_with_users), function($id) {
        return is_int($id) && $id > 0;
    }));

    // Get summary info
    $title = $post_after->post_title;
    $product_count = get_field('product_count', $post_id);
    $bagged_count = get_field('bagged_product_count', $post_id);
    $checked_count = get_field('checked_product_count', $post_id);

    $summary = [
        'list_id' => $post_id,
        'title' => $title,
        'product_count' => $product_count,
        'bagged_product_count' => $bagged_count,
        'checked_product_count' => $checked_count,
        'event_id' => uniqid(),
        'message' => 'List renamed',
        'sender_id' => get_current_user_id(),
    ];

    // Send to all users with access
    $pusher = new Pusher\Pusher(
        'a9f747a06cd5ec1d8c62',
        'c30a7a8803655f65cdaf',
        '1990193',
        ['cluster' => 'eu', 'useTLS' => true]
    );
    foreach ($user_ids as $uid) {
        $pusher->trigger('user-lists-' . $uid, 'list-summary-updated', $summary);
    }
}, 10, 3);
