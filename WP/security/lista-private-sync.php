<?php
/** Private synchronization: stores only per-account revision markers in WordPress. */
function lista_private_touch_user($id) {
    if ((int) $id > 0) update_user_meta((int) $id, '_lista_sync_revision', wp_generate_uuid4());
}
function lista_private_touch_list($id) {
    if (get_post_type($id) !== 'shopping-list') return;
    lista_private_touch_user(get_post_meta($id, 'owner_id', true));
    foreach ((array) get_post_meta($id, 'shared_with_users', true) as $uid) lista_private_touch_user($uid);
}
// Capture recipients before and after membership/ownership changes, including
// a removed member. No list contents or membership IDs leave WordPress.
add_filter('update_post_metadata', function ($check, $id, $key) { lista_private_touch_list($id); return $check; }, 10, 3);
add_action('updated_post_meta', function ($mid, $id) { lista_private_touch_list($id); }, 10, 2);
add_action('added_post_meta', function ($mid, $id) { lista_private_touch_list($id); }, 10, 2);
add_action('save_post_shopping-list', 'lista_private_touch_list', 100);
add_action('wp_trash_post', 'lista_private_touch_list', 1);
add_action('before_delete_post', 'lista_private_touch_list', 1);
add_action('rest_api_init', function () {
    register_rest_route('custom/v1', '/sync-revision', ['methods' => 'GET',
        'permission_callback' => 'lista_private_session',
        'callback' => function () {
            $response = new WP_REST_Response(['revision' => (string) get_user_meta(get_current_user_id(), '_lista_sync_revision', true)]);
            $response->header('Cache-Control', 'private, no-store');
            return $response;
        },
    ]);
});
// Compatibility sink for the old event callers. Revised clients fetch through
// authenticated REST; old Pusher channels must never receive private payloads.
class Lista_Private_Event_Sink {
    public function trigger($channels, $event, $data) { return true; }
}
function lista_private_events() { return new Lista_Private_Event_Sink(); }
