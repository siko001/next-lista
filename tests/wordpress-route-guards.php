<?php
// Local authorization contract checks; does not contact or mutate WordPress.
class WP_Error {
    public function __construct(public $code, public $message, public $data) {}
}
class WP_REST_Response {
    public $headers = [];
    public function __construct(public $data) {}
    public function get_data() { return $this->data; }
    public function set_data($data) { $this->data = $data; }
    public function header($key, $value) { $this->headers[$key] = $value; }
}
class GuardRequest {
    public function __construct(public $route, public $params = [], public $method = 'POST') {}
    public function get_route() { return $this->route; }
    public function get_method() { return $this->method; }
    public function get_param($key) { return $this->params[$key] ?? null; }
    public function set_param($key, $value) { $this->params[$key] = $value; }
}
function is_wp_error($value) { return $value instanceof WP_Error; }
function add_filter($name, $callback, $priority, $arguments) { $GLOBALS['filters'][$name] = $callback; }
function get_current_user_id() { return $GLOBALS['uid']; }
function get_post($id) { return $GLOBALS['posts'][$id] ?? null; }
function get_field($name, $id, $format = true) { return $GLOBALS['fields'][$id][$name] ?? null; }
function get_user_by($field, $id) { return $id > 0 && $id < 10 ? (object) ['ID' => $id] : false; }
function rest_ensure_response($value) { return $value instanceof WP_REST_Response ? $value : new WP_REST_Response($value); }
require __DIR__ . '/../WP/security/lista-route-guards.php';

$posts = [
    10 => (object) ['post_type' => 'shopping-list', 'post_status' => 'publish'],
    11 => (object) ['post_type' => 'shopping-list', 'post_status' => 'publish'],
    12 => (object) ['post_type' => 'shopping-list', 'post_status' => 'trash'],
    20 => (object) ['post_type' => 'custom-product', 'post_status' => 'publish'],
    21 => (object) ['post_type' => 'custom-product', 'post_status' => 'publish'],
    22 => (object) ['post_type' => 'post', 'post_status' => 'publish'],
];
$fields = [
    10 => ['owner_id' => '1', 'shared_with_users' => ['2', '3']],
    11 => ['owner_id' => 4, 'shared_with_users' => []],
    12 => ['owner_id' => 1],
    20 => ['product_owner' => '2'], 21 => ['product_owner' => 4], 22 => ['product_owner' => 2],
];
$checks = 0;
function check($condition, $message) {
    global $checks;
    if (!$condition) throw new Exception($message);
    $checks++;
}
function run_guard($actor, $route, $params = []) {
    $GLOBALS['uid'] = $actor;
    $request = new GuardRequest($route, $params);
    $result = lista_guard_custom_routes(null, [], $request);
    return [$result, $request];
}
function status($result) { return is_wp_error($result) ? $result->data['status'] : 200; }

foreach ([0, -1, '01', '1x', '1.0', 1.0, true, [], '99999999999999999999999'] as $invalid) {
    check(lista_guard_id($invalid) === 0, 'Reject noncanonical IDs');
}
foreach ([1, 2] as $actor) {
    [$result] = run_guard($actor, '/custom/v1/shopping-list/10', ['id' => '10']);
    check(status($result) === 200, 'Owner and member can read their list');
}
foreach ([0 => 401, 4 => 403] as $actor => $expected) {
    [$result] = run_guard($actor, '/custom/v1/shopping-list/10', ['id' => 10]);
    check(status($result) === $expected, 'Anonymous and unrelated accounts cannot read a list');
}
[$result] = run_guard(1, '/custom/v1/shopping-list/10', ['id' => 11]);
check(status($result) === 400, 'Query/body parameters cannot substitute another path ID');
[$result] = run_guard(1, '/custom/v1/shopping-lists-by-owner/1', ['owner_id' => 4]);
check(status($result) === 403, 'Query/body parameters cannot substitute another account');
[$result] = run_guard(1, '/custom/v1/shopping-lists-by-owner/1', ['owner_id' => '1']);
check(status($result) === 200, 'Account can load its own lists');
[$result] = run_guard(1, '/custom/v1/shopping-list/12', ['id' => 12]);
check(status($result) === 404, 'Trashed lists stay unavailable');

foreach (['get-shopping-list-products', 'update-shopping-list', 'update-bagged-products', 'get-bagged-products',
    'bag-all-products', 'remove-checked-products', 'remove-bagged-products', 'unbag-all-products'] as $route) {
    foreach ([0 => 401, 2 => 200, 4 => 403] as $actor => $expected) {
        [$result] = run_guard($actor, '/custom/v1/' . $route, ['shoppingListId' => 10]);
        check(status($result) === $expected, 'List product route enforces current membership: ' . $route);
    }
}
[$result] = run_guard(4, '/custom/v1/copy-shopping-list', ['source_list_id' => 10]);
check(status($result) === 403, 'Cannot copy another account list');
[$result] = run_guard(4, '/custom/v1/empty/10', ['id' => 10]);
check(status($result) === 403, 'Cannot empty another account list');
[$result] = run_guard(4, '/CUSTOM/v1/EMPTY/10/', ['id' => 10]);
check(status($result) === 403, 'Case-insensitive routes and trailing slashes cannot bypass checks');
$uid = 0;
check(lista_guard_custom_routes(null, [], new GuardRequest('/custom/v1/update-shopping-list', [], 'OPTIONS')) === null, 'Allow cross-origin preflight without a session');
foreach ([20 => 200, 21 => 403, 22 => 403, 999 => 403] as $product => $expected) {
    [$result] = run_guard(2, '/custom/v1/delete-custom-product', ['shoppingListId' => 10, 'productId' => $product]);
    check(status($result) === $expected, 'Only owned custom products can be deleted');
}
[$result] = run_guard(2, '/custom/v1/delete-custom-product', ['shoppingListId' => 11, 'productId' => 20]);
check(status($result) === 403, 'Product ownership does not grant access to a different list');

foreach ([[1, 2, 200], [2, 2, 200], [2, 3, 403], [4, 2, 403], [1, 1, 403], [1, 8, 403]] as [$actor, $target, $expected]) {
    [$result, $request] = run_guard($actor, '/custom/v1/remove-user-from-shared', [
        'listId' => '10', 'userId' => (string) $target, 'notifyUsers' => ['ownerId' => 999],
    ]);
    check(status($result) === $expected, 'Only owner removal or self-removal is permitted');
    if ($expected === 200) {
        check($request->get_param('notifyUsers') === ['removedUserId' => 2, 'ownerId' => 1, 'sharedUserIds' => [3]], 'Recipients come from stored membership');
        check($request->get_param('userId') === 2, 'Normalize target for existing strict comparisons');
    }
}
foreach ([0 => 401, 1 => 200, 2 => 403, 4 => 403] as $actor => $expected) {
    [$result] = run_guard($actor, '/custom/v1/share-list', ['list_id' => 10, 'user_id' => 8]);
    check(status($result) === $expected, 'Legacy direct sharing requires the owner');
}
[$result] = run_guard(1, '/custom/v1/share-list', ['list_id' => 10, 'user_id' => 999]);
check(status($result) === 400, 'Direct share recipient must exist');
[$result] = run_guard(1, '/wp/v2/shopping-list/order', ['orders' => [['id' => 10, 'menu_order' => 0], ['id' => 11, 'menu_order' => 1]]]);
check(status($result) === 403, 'Reject entire mixed-ownership reorder batch before writes');
[$result] = run_guard(1, '/wp/v2/shopping-list/order', ['orders' => [['id' => 10, 'menu_order' => 0]]]);
check(status($result) === 200, 'Allow valid reorder');

$response = $filters['rest_request_after_callbacks'](new WP_REST_Response([
    'id' => 10, 'acf' => ['owner_id' => 1, 'owner_token' => 'private-token', 'share_code' => 'private-invite'],
    'meta' => ['owner_token' => ['private-token']],
]), [], new GuardRequest('/CUSTOM/v1/SHOPPING-LIST/10'));
check($response->get_data() === ['id' => 10, 'acf' => ['owner_id' => 1], 'meta' => []], 'Credentials omitted recursively from list responses');
check($response->headers['Cache-Control'] === 'private, no-store', 'Private responses cannot enter shared caches');
[$result] = run_guard(0, '/custom/v1/shared-list/10');
check(status($result) === 200, 'Existing invite landing preflight remains compatible; it returns only the supplied ID');
[$result] = run_guard(0, '/custom/v1/create-user');
check(status($result) === 200, 'Separate guest migration is not silently changed by these guards');
echo "$checks route authorization checks passed.\n";
