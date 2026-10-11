<?php
define('ABSPATH', __DIR__);
$hooks = [];
$posts = [];
$events = [];
function add_filter($name, $callback, ...$rest) { $GLOBALS['hooks'][$name] = $callback; }
function add_action($name, $callback, ...$rest) { $GLOBALS['hooks'][$name] = $callback; }
function absint($value) { return abs((int) $value); }
function get_current_user_id() { return 7; }
function get_post_type($id) { return isset($GLOBALS['posts'][$id]) ? 'shopping-list' : false; }
function get_field($key, $id) { return $GLOBALS['posts'][$id][$key] ?? null; }
function wp_generate_uuid4() { return 'test-event'; }
function current_user_can($permission) { return true; }
class WP_Error {}
class WP_REST_Response {
    public function __construct(private $data, private $status = 200) {}
    public function get_status() { return $this->status; }
    public function get_data() { return $this->data; }
}
class Request {
    public function __construct(private $method, private $route, private $params = []) {}
    public function get_method() { return $this->method; }
    public function get_route() { return $this->route; }
    public function get_param($key) { return $this->params[$key] ?? null; }
}
function is_wp_error($value) { return $value instanceof WP_Error; }
function rest_ensure_response($value) { return $value instanceof WP_REST_Response ? $value : new WP_REST_Response($value); }
function setup_pusher() { return new class {
    public function trigger($channel, $event, $data) { $GLOBALS['events'][] = [$channel, $event, $data]; }
}; }
function check($condition, $message) { if (!$condition) throw new RuntimeException($message); }
function before($request) { ($GLOBALS['hooks']['rest_request_before_callbacks'])(null, [], $request); }
function after($request, $response) {
    check(($GLOBALS['hooks']['rest_request_after_callbacks'])($response, [], $request) === $response, 'REST response changed');
}
function flush_events() {
    ($GLOBALS['hooks']['shutdown'])();
    $events = $GLOBALS['events']; $GLOBALS['events'] = [];
    foreach ($events as $event) {
        check($event[1] === 'lists-changed', 'Wrong event');
        check(array_keys($event[2]) === ['event_id'], 'Event should contain no account or list contents');
    }
    $channels = array_column($events, 0); sort($channels); return $channels;
}
require __DIR__ . '/../WP/lista-sync-events/lista-sync-events.php';

$create = new Request('POST', '/wp/v2/shopping-list', ['title' => 'New list']);
before($create);
$posts[101] = ['owner_id' => 7, 'shared_with_users' => [['ID' => 8]]];
after($create, new WP_REST_Response(['id' => 101], 201));
check(!$events, 'Create published before the REST write completed');
check(flush_events() === ['user-lists-7', 'user-lists-8'], 'Create must notify owner and collaborators');

$posts[102] = ['owner_id' => 7, 'shared_with_users' => [9]];
$order = new Request('POST', '/wp/v2/shopping-list/order', ['orders' => [['id' => 101, 'menu_order' => 2], ['id' => 102, 'menu_order' => 1]]]);
before($order); after($order, ['success' => true]);
check(flush_events() === ['user-lists-7', 'user-lists-8', 'user-lists-9'], 'Order must notify each affected user exactly once');

$remove = new Request('POST', '/custom/v1/remove-user-from-shared', ['listId' => 101, 'userId' => 8]);
before($remove); $posts[101]['shared_with_users'] = [];
after($remove, ['success' => true]);
check(flush_events() === ['user-lists-7', 'user-lists-8'], 'Removed member must invalidate former access');

$delete = new Request('DELETE', '/wp/v2/shopping-list/102', ['id' => 102]);
before($delete); unset($posts[102]); after($delete, ['deleted' => true]);
check(flush_events() === ['user-lists-7', 'user-lists-9'], 'Delete lost its former recipients');

foreach ([new WP_Error(), new WP_REST_Response([], 403), ['success' => false], ['error' => 'failed']] as $failure) {
    before($order); after($order, $failure);
    check(flush_events() === [], 'Failed write emitted a change');
}
foreach ([new Request('GET', '/wp/v2/shopping-list'), new Request('POST', '/custom/v1/create-user')] as $unrelated) {
    before($unrelated); after($unrelated, ['id' => 101]);
    check(flush_events() === [], 'Read/unrelated write emitted a list change');
}
$bag = new Request('POST', '/custom/v1/update-shopping-list', ['shoppingListId' => 101, 'action' => 'bag']);
before($bag); after($bag, ['success' => true]);
check(flush_events() === ['user-lists-7'], 'Same-account product change was excluded');
// Ownership transfers return the affected IDs rather than a single list.
$claim = new Request('POST', '/custom/v1/claim-guest-lists');
before($claim); $posts[101]['owner_id'] = 10;
after($claim, ['success' => true, 'list_ids' => [101]]);
check(flush_events() === ['user-lists-10', 'user-lists-7'], 'Transfer must notify the destination account');
check(flush_events() === [], 'Duplicate shutdown event');
echo "List sync event checks passed\n";
