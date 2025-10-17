<?php

add_action('save_post_shopping-list', function($post_id, $post, $update) {
    // Only run on updates, not on new posts (optional)
    if (!$update) return;
	// Only run if not trashing or deleting
    if ($post->post_status === 'trash' || $post->post_status === 'auto-draft') return;


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
    $title = get_the_title($post_id);
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
