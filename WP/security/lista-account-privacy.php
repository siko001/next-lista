<?php
/** Lista account privacy. Requires lista-route-guards.php. */

function lista_private_error($message = 'This action is not available.', $status = 403) {
    return new WP_Error('lista_private_access', $message, ['status' => $status]);
}
function lista_private_session() {
    return get_current_user_id() ? true : lista_private_error('A valid Lista session is required.', 401);
}
function lista_private_is_guest($user) {
    if (!$user) return false;
    return get_user_meta($user->ID, '_lista_guest', true) === 'yes'
        || (preg_match('/^lista-user-[0-9]+$/D', $user->user_login)
            && preg_match('/^lista-user[0-9]+@lista\.com$/D', $user->user_email));
}
function lista_private_is_app_user($user) {
    if (!$user || in_array('administrator', (array) $user->roles, true)) return false;
    return lista_private_is_guest($user) || preg_match('/^lista-(user-|guest-)/', $user->user_login)
        || in_array(get_user_meta($user->ID, 'registered', true), ['yes', 'no'], true)
        || get_user_meta($user->ID, 'google_id', true);
}
add_action('init', function () { add_role('lista_member', 'Lista member', ['read' => true]); });
// Restrict existing app accounts immediately, even before their stored role is migrated.
add_filter('user_has_cap', function ($caps, $required, $args, $user) {
    return lista_private_is_app_user($user) ? ['read' => true, 'exist' => true] : $caps;
}, 999, 4);
function lista_private_migrate_user($user) {
    if (!lista_private_is_app_user($user)) return;
    if (lista_private_is_guest($user)) {
        update_user_meta($user->ID, '_lista_guest', 'yes');
        update_user_meta($user->ID, 'registered', 'no');
        if (!get_user_meta($user->ID, '_lista_password_hardened', true)) {
            // JWT sessions remain valid; only the insecure password login is retired.
            wp_set_password(wp_generate_password(64, true, true), $user->ID);
            update_user_meta($user->ID, '_lista_password_hardened', 'yes');
        }
    }
    if ($user->roles !== ['lista_member']) $user->set_role('lista_member');
}
function lista_private_migrate_batch() {
    $offset = (int) get_option('lista_privacy_migration_offset', 0);
    if ($offset < 0) return;
    $users = get_users(['number' => 100, 'offset' => $offset, 'orderby' => 'ID', 'order' => 'ASC']);
    foreach ($users as $user) lista_private_migrate_user($user);
    update_option('lista_privacy_migration_offset', count($users) < 100 ? -1 : $offset + count($users), false);
    if (count($users) === 100 && !wp_next_scheduled('lista_privacy_migrate')) wp_schedule_single_event(time() + 10, 'lista_privacy_migrate');
}
add_action('lista_privacy_migrate', 'lista_private_migrate_batch');
add_action('admin_init', function () { if (current_user_can('manage_options')) lista_private_migrate_batch(); });

function lista_private_limit($purpose, $limit, $seconds) {
    $identity = get_current_user_id() ?: ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    $key = 'lista_limit_' . hash_hmac('sha256', $purpose . ':' . $identity . ':' . floor(time() / $seconds), wp_salt('auth'));
    global $wpdb;
    $lock = 'lista-rate-' . substr(hash('sha256', $key), 0, 40);
    if ((int) $wpdb->get_var($wpdb->prepare('SELECT GET_LOCK(%s, 2)', $lock)) !== 1) return lista_private_error('Please retry shortly.', 503);
    try {
        $count = (int) get_transient($key);
        if ($count >= $limit) return lista_private_error('Please wait before trying again.', 429);
        set_transient($key, $count + 1, $seconds);
        return true;
    } finally { $wpdb->get_var($wpdb->prepare('SELECT RELEASE_LOCK(%s)', $lock)); }
}
function lista_private_jwt($id) {
    if (!defined('JWT_AUTH_SECRET_KEY') || !JWT_AUTH_SECRET_KEY || !class_exists('Firebase\\JWT\\JWT')) {
        return lista_private_error('Session service unavailable.', 503);
    }
    $now = time();
    return Firebase\JWT\JWT::encode([
        'iss' => get_bloginfo('url'), 'iat' => $now, 'nbf' => $now, 'exp' => $now + 7 * DAY_IN_SECONDS,
        'data' => ['user' => ['id' => $id]],
    ], JWT_AUTH_SECRET_KEY, 'HS256');
}
function lista_private_create_guest($request) {
    $limit = lista_private_limit('guest', 20, HOUR_IN_SECONDS);
    if (is_wp_error($limit)) return $limit;
    $random = bin2hex(random_bytes(24));
    $username = 'lista-guest-' . $random;
    $id = wp_insert_user(['user_login' => $username, 'user_pass' => wp_generate_password(64, true, true),
        'user_email' => '', 'display_name' => 'Guest', 'role' => 'lista_member']);
    if (is_wp_error($id)) return lista_private_error('Could not create your guest session.', 503);
    update_user_meta($id, '_lista_guest', 'yes');
    update_user_meta($id, '_lista_password_hardened', 'yes');
    update_user_meta($id, 'registered', 'no');
    $token = lista_private_jwt($id);
    if (is_wp_error($token)) return $token;
    // Old clients exchange username + the historical password. Give them a
    // one-use, unguessable login ticket, never the account's actual username.
    $ticket = 'lista-session-' . bin2hex(random_bytes(32));
    add_option('lista_ticket_' . hash('sha256', $ticket), ['id' => $id, 'expires' => time() + 120], '', false);
    wp_schedule_single_event(time() + 130, 'lista_privacy_expire_ticket', [$ticket]);
    $response = new WP_REST_Response(['user_id' => $id, 'username' => $ticket, 'email' => '',
        'name' => 'Guest', 'registered' => 'no', 'token' => $token], 200);
    $response->header('Cache-Control', 'private, no-store');
    return $response;
}
add_action('lista_privacy_expire_ticket', function ($ticket) { delete_option('lista_ticket_' . hash('sha256', $ticket)); });
add_filter('authenticate', function ($user, $username, $password) {
    if (is_string($username) && preg_match('/^lista-session-[a-f0-9]{64}$/D', $username)) {
        $key = 'lista_ticket_' . hash('sha256', $username);
        $ticket = get_option($key);
        if (!$ticket || $ticket['expires'] < time() || !delete_option($key)) return lista_private_error('Guest session expired.', 401);
        return get_user_by('id', (int) $ticket['id']) ?: lista_private_error('Guest session expired.', 401);
    }
    if ($user instanceof WP_User && lista_private_is_guest($user)) return lista_private_error('Open Lista to start a guest session.', 401);
    return $user;
}, 99, 3);

function lista_private_profile($request) {
    $user = wp_get_current_user();
    lista_private_migrate_user($user);
    return ['id' => $user->ID, 'username' => lista_private_is_guest($user) ? 'guest' : $user->user_login,
        'email' => lista_private_is_guest($user) ? '' : $user->user_email,
        'registered' => lista_private_is_guest($user) ? 'no' : 'yes', 'name' => $user->display_name];
}
function lista_private_register($request) {
    $user = wp_get_current_user();
    if (!lista_private_is_guest($user)) return lista_private_error('This account is already registered.');
    $params = $request->get_json_params();
    if (!is_array($params) || array_diff(array_keys($params), ['name', 'email', 'password'])) return lista_private_error('Unsupported profile fields.', 400);
    $email = sanitize_email($params['email'] ?? '');
    if (!is_email($email) || !preg_match('/\.[^\.\s]{2,}$/D', $email)) return new WP_Error('rest_user_invalid_email', 'Enter a valid email address.', ['status' => 400]);
    if (email_exists($email)) return new WP_Error('existing_user_email', 'This email is already registered.', ['status' => 400]);
    $password = $params['password'] ?? '';
    $name = sanitize_text_field($params['name'] ?? '');
    if (!is_string($password) || strlen($password) < 8 || strlen($password) > 256 || !$name) return lista_private_error('Use a name and a password of at least 8 characters.', 400);
    $id = wp_update_user(['ID' => $user->ID, 'user_email' => $email, 'display_name' => $name, 'user_pass' => $password]);
    if (is_wp_error($id)) return $id;
    delete_user_meta($id, '_lista_guest');
    update_user_meta($id, 'registered', 'yes');
    return ['id' => $id, 'name' => $name, 'email' => $email];
}
function lista_private_native_list($request) {
    $route = strtolower(rtrim($request->get_route(), '/'));
    $id = preg_match('#/([0-9]+)$#D', $route, $match) ? lista_guard_id($match[1]) : 0;
    $method = $request->get_method();
    if ($id && lista_guard_id($request->get_param('id')) !== $id) return lista_private_error('Invalid list ID.', 400);
    if ($id) {
        $access = lista_guard_list($id, $method === 'DELETE');
        if (is_wp_error($access)) return $access;
    }
    if ($method === 'GET' || $method === 'HEAD') {
        if (!$id) {
            $read = new WP_REST_Request('GET'); $read->set_param('owner_id', get_current_user_id());
            return get_shopping_lists_by_owner($read);
        }
        return lista_private_list_response($id);
    }
    if ($method === 'DELETE') {
        if ($request->get_param('force')) return lista_private_error('Permanent deletion is not supported here.', 400);
        $post = wp_trash_post($id);
        return $post ? ['id' => $id, 'status' => 'trash'] : lista_private_error('Could not delete this list.', 500);
    }
    $params = $request->get_json_params();
    if (!is_array($params) || array_diff(array_keys($params), ['title', 'status', 'menu_order', 'acf'])) return lista_private_error('Unsupported list fields.', 400);
    $fields = $params['acf'] ?? [];
    // Accept and discard legacy owner fields on creation; never trust them.
    if (!is_array($fields) || ($id && count($fields)) || (!$id && array_diff(array_keys($fields), ['owner_id', 'owner_token']))) return lista_private_error('Protected list fields.', 400);
    if (isset($params['status']) && $params['status'] !== 'publish') return lista_private_error('Invalid list status.', 400);
    if (isset($params['menu_order']) && !is_int($params['menu_order'])) return lista_private_error('Invalid list order.', 400);
    $title = $params['title'] ?? '';
    if (!is_string($title) || !trim($title) || strlen($title) > 500) return lista_private_error('Enter a list name.', 400);
    $data = ['post_title' => sanitize_text_field($title)];
    if (isset($params['menu_order'])) $data['menu_order'] = $params['menu_order'];
    if ($id) { $data['ID'] = $id; $saved = wp_update_post($data, true); }
    else { $saved = wp_insert_post($data + ['post_type' => 'shopping-list', 'post_status' => 'publish', 'post_author' => get_current_user_id()], true); }
    if (is_wp_error($saved)) return $saved;
    if (!$id) {
        update_field('owner_id', get_current_user_id(), $saved);
        update_field('owner_name', wp_get_current_user()->display_name, $saved);
    }
    delete_post_meta($saved, 'owner_token');
    return new WP_REST_Response(lista_private_list_response($saved), $id ? 200 : 201);
}
function lista_private_list_response($id) {
    $post = get_post($id);
    return ['id' => $id, 'title' => ['rendered' => $post->post_title], 'status' => $post->post_status,
        'menu_order' => (int) $post->menu_order, 'acf' => lista_guard_strip_credentials(get_fields($id) ?: [])];
}

// Replace only known app endpoints. Native WordPress editorial permissions are
// never granted to app users merely to make a shopping-list operation work.
add_filter('rest_endpoints', function ($routes) {
    $app_routes = ['get-shopping-list-products', 'update-shopping-list', 'update-bagged-products', 'get-bagged-products',
        'bag-all-products', 'remove-checked-products', 'remove-bagged-products', 'unbag-all-products',
        'copy-shopping-list', 'delete-custom-product', 'create-custom-product', 'get-custom-products'];
    foreach ($routes as $route => &$handlers) {
        foreach ($handlers as &$handler) {
            if (!is_array($handler) || !isset($handler['callback'])) continue;
            if (in_array($route, array_map(function ($name) { return '/custom/v1/' . $name; }, $app_routes), true)
                || $route === '/wp/v2/shopping-list/order' || strpos($route, '/custom/v1/empty/') === 0) $handler['permission_callback'] = 'lista_private_session';
            if ($route === '/custom/v1/create-user') $handler['callback'] = 'lista_private_create_guest';
            if ($route === '/custom/v1/user-data') { $handler['callback'] = 'lista_private_profile'; $handler['permission_callback'] = 'lista_private_session'; }
            if ($route === '/wp/v2/shopping-list' || $route === '/wp/v2/shopping-list/(?P<id>[\\d]+)') {
                $handler['callback'] = 'lista_private_native_list'; $handler['permission_callback'] = 'lista_private_session';
                $handler['args'] = [];
            }
            if ($route === '/wp/v2/users/me') {
                $handler['callback'] = function ($request) { return in_array($request->get_method(), ['GET','HEAD'], true) ? lista_private_profile($request) : lista_private_register($request); };
                $handler['permission_callback'] = 'lista_private_session'; $handler['args'] = [];
            }
            if ($route === '/custom/v1/claim-guest-lists') {
                $handler['permission_callback'] = function () { return lista_private_is_guest(wp_get_current_user()) ? true : lista_private_error('A guest session is required.'); };
            }
        }
    }
    return $routes;
}, 100);

add_filter('rest_request_before_callbacks', function ($response, $handler, $request) {
    if (is_wp_error($response) || $request->get_method() === 'OPTIONS') return $response;
    $route = strtolower(rtrim($request->get_route(), '/'));
    $admin = current_user_can('manage_options');
    // These legacy routes issue sessions from caller-supplied email addresses.
    // Neither is used by the current email/password UI; deny until replaced by
    // a properly verified Google ID-token exchange.
    if (in_array($route, ['/custom/v1/google-auth', '/custom/v1/link-google-account'], true)) return lista_private_error('Use email and password to sign in.');
    if (!$admin && (preg_match('#^/(acf/|wp/v2/(users(?:/|$)|custom-product(?:/|$)|search(?:/|$)))#', $route)) && $route !== '/wp/v2/users/me') return lista_private_error();
    if (!$admin && preg_match('#^/wp/v2/shopping-list/#', $route) && !preg_match('#^/wp/v2/shopping-list/(?:[0-9]+|order)$#D', $route)) return lista_private_error();
    if ($route === '/custom/v1/claim-guest-lists') {
        $guest = wp_get_current_user();
        if (!lista_private_is_guest($guest)) return lista_private_error('A guest session is required.');
        // The old transfer callback infers registration from a changed password.
        // Validate the destination's actual guest marker before invoking it.
        $token = $request->get_param('account_token');
        if (!is_string($token) || !preg_match('/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/D', $token)) return lista_private_error('Invalid account session.', 400);
        $identity = wp_remote_get(rest_url('custom/v1/user-data'), ['headers' => ['Authorization' => 'Bearer ' . $token], 'timeout' => 15, 'redirection' => 0]);
        if (is_wp_error($identity) || wp_remote_retrieve_response_code($identity) !== 200) return lista_private_error('Could not verify the account session.');
        $data = json_decode(wp_remote_retrieve_body($identity), true);
        if (($data['registered'] ?? '') !== 'yes') return lista_private_error('Sign in to a registered account first.');
    }
    if (get_current_user_id()) lista_private_migrate_user(wp_get_current_user());
    return $response;
}, 10, 3);
add_filter('rest_request_after_callbacks', function ($response, $handler, $request) {
    if (is_wp_error($response)) return $response;
    if (preg_match('#^/(custom/|wp/v2/(shopping-list|users/me))#i', $request->get_route())) {
        $response = rest_ensure_response($response);
        $response->header('Cache-Control', 'private, no-store');
        if (preg_match('#^/(wp/v2/shopping-list|custom/v1/copy-shopping-list)#i', $request->get_route())) $response->set_data(lista_guard_strip_credentials($response->get_data()));
    }
    return $response;
}, 99, 3);
add_filter('register_post_type_args', function ($args, $type) {
    if (in_array($type, ['shopping-list', 'custom-product'], true)) { $args['public'] = false; $args['publicly_queryable'] = false; $args['exclude_from_search'] = true; }
    return $args;
}, 99, 2);
add_filter('wp_sitemaps_post_types', function ($types) { unset($types['shopping-list'], $types['custom-product']); return $types; });

function lista_private_product_access($id, $list_id = 0) {
    $post = get_post($id);
    if (!$post || $post->post_status !== 'publish') return false;
    if ($post->post_type === 'product') return true;
    if ($post->post_type !== 'custom-product') return false;
    if ((int) get_field('product_owner', $id, false) === get_current_user_id()) return true;
    if (!$list_id) {
        // A collaborator may favourite a product already visible in a shared list.
        $uid = get_current_user_id();
        foreach (get_posts(['post_type' => 'shopping-list', 'post_status' => 'publish', 'posts_per_page' => -1, 'fields' => 'ids',
            'meta_query' => ['relation' => 'OR', ['key' => 'owner_id', 'value' => $uid],
                ['key' => 'shared_with_users', 'value' => '"' . $uid . '"', 'compare' => 'LIKE']]]) as $candidate) {
            if (!is_wp_error(lista_guard_list($candidate)) && in_array($id, array_map('intval', (array) get_field('linked_products', $candidate, false)), true)) return true;
        }
    }
    return $list_id && !is_wp_error(lista_guard_list($list_id))
        && in_array($id, array_map('intval', (array) get_field('linked_products', $list_id, false)), true);
}
add_filter('rest_request_before_callbacks', function ($response, $handler, $request) {
    if (is_wp_error($response) || $request->get_method() === 'OPTIONS') return $response;
    $route = strtolower(rtrim($request->get_route(), '/'));
    if (in_array($route, ['/custom/v1/update-shopping-list', '/custom/v1/update-bagged-products', '/custom/v1/add-to-favourites'], true)) {
        $id = lista_guard_id($request->get_param('productId'));
        $list = lista_guard_id($request->get_param('shoppingListId'));
        if (!lista_private_product_access($id, $list)) return lista_private_error('This product is unavailable.');
    }
    return $response;
}, 30, 3);

// Never copy or persist bearer credentials in shopping-list metadata.
foreach (['add_post_metadata', 'update_post_metadata'] as $hook) {
    add_filter($hook, function ($check, $id, $key) {
        return $key === 'owner_token' ? true : $check;
    }, 1, 3);
}

// Finish the legacy list-claim operation by transferring guest-owned products
// and favourites too. The destination was authenticated before the callback.
add_filter('rest_request_after_callbacks', function ($response, $handler, $request) {
    if (strtolower(rtrim($request->get_route(), '/')) !== '/custom/v1/claim-guest-lists' || is_wp_error($response)) return $response;
    $data = rest_ensure_response($response)->get_data();
    if (empty($data['success'])) return $response;
    $guest = get_current_user_id();
    $account = (int) get_user_meta($guest, '_lista_claimed_by', true);
    if (!$account || $account === $guest) return $response;
    foreach (get_posts(['post_type' => 'custom-product', 'post_status' => ['publish', 'trash'], 'posts_per_page' => -1,
        'fields' => 'ids', 'meta_key' => 'product_owner', 'meta_value' => $guest]) as $id) {
        update_field('product_owner', $account, $id);
        wp_update_post(['ID' => $id, 'post_author' => $account]);
    }
    $favourites = array_values(array_unique(array_merge(lista_private_favourites($account), lista_private_favourites($guest))));
    update_user_meta($account, 'favourite_products', $favourites);
    update_user_meta($guest, 'favourite_products', []);
    return $response;
}, 110, 3);

// Fresh users have no ACF field-reference metadata. Read/write the relationship
// IDs directly so a successful first save is also readable on the next request.
// Normalize old formatted WP_Post values left by the legacy add callback too.
function lista_private_favourites($uid) {
    $ids = [];
    foreach ((array) get_user_meta($uid, 'favourite_products', true) as $value) {
        $id = lista_guard_id(is_object($value) ? ($value->ID ?? 0) : (is_array($value) ? ($value['ID'] ?? 0) : $value));
        if ($id) $ids[] = $id;
    }
    return array_values(array_unique($ids));
}
function lista_private_favourite_request($request) {
    $uid = get_current_user_id();
    $ids = lista_private_favourites($uid);
    $route = strtolower(rtrim($request->get_route(), '/'));
    if ($route === '/custom/v1/get-favourites') {
        $result = [];
        foreach ($ids as $id) {
            $post = get_post($id);
            if ($post && $post->post_status === 'publish' && lista_private_product_access($id)) {
                $result[] = ['id' => $id, 'title' => $post->post_title];
            }
        }
        return $result;
    }
    $id = lista_guard_id($request->get_param('productId'));
    if (!$id) return lista_private_error('Invalid product.', 400);
    if ($route === '/custom/v1/add-to-favourites') {
        if (!lista_private_product_access($id)) return lista_private_error('This product is unavailable.');
        $ids = array_values(array_unique(array_merge($ids, [$id])));
    } else { $ids = array_values(array_diff($ids, [$id])); }
    update_user_meta($uid, 'favourite_products', $ids);
    return ['success' => true, 'productId' => $id, 'userId' => $uid, 'favourites' => $ids];
}
add_filter('rest_endpoints', function ($routes) {
    foreach (['get-favourites', 'add-to-favourites', 'remove-from-favourites'] as $name) {
        $path = '/custom/v1/' . $name;
        if (!isset($routes[$path])) continue;
        foreach ($routes[$path] as &$handler) {
            if (!is_array($handler) || !isset($handler['callback'])) continue;
            $handler['callback'] = 'lista_private_favourite_request';
            $handler['permission_callback'] = 'lista_private_session';
        }
        unset($handler);
    }
    return $routes;
}, 110);

add_action('rest_api_init', function () {
    register_rest_route('custom/v1', '/assistant-quota', ['methods' => 'POST', 'permission_callback' => 'lista_private_session',
        'callback' => function ($request) {
            $limit = lista_private_limit('assistant', lista_private_is_guest(wp_get_current_user()) ? 40 : 120, HOUR_IN_SECONDS);
            return is_wp_error($limit) ? $limit : lista_private_profile($request);
        },
    ]);
});
add_filter('rest_request_before_callbacks', function ($response, $handler, $request) {
    if (is_wp_error($response) || $request->get_method() === 'OPTIONS') return $response;
    $route = strtolower(rtrim($request->get_route(), '/'));
    if (in_array($route, ['/custom/v1/bag-all-products', '/custom/v1/unbag-all-products'], true)) {
        $list = lista_guard_id($request->get_param('shoppingListId'));
        $rows = $request->get_param('baggedProducts');
        $linked = array_map('intval', (array) get_field('linked_products', $list, false));
        if (!is_array($rows) || count($rows) > 1000) return lista_private_error('Invalid product selection.', 400);
        foreach ($rows as $row) {
            $id = is_array($row) ? lista_guard_id($row['id'] ?? 0) : 0;
            if (!$id || !in_array($id, $linked, true) || !lista_private_product_access($id, $list)) return lista_private_error('Only products already in this list can be selected.');
        }
    }
    if ($route === '/custom/v1/send-reset-link' || $route === '/custom-api/v1/check-email') {
        $limit = lista_private_limit('account-lookup', 20, HOUR_IN_SECONDS);
        if (is_wp_error($limit)) return $limit;
    }
    return $response;
}, 40, 3);
add_filter('rest_request_after_callbacks', function ($response, $handler, $request) {
    if (is_wp_error($response)) return $response;
    $route = strtolower(rtrim($request->get_route(), '/'));
    $data = rest_ensure_response($response)->get_data();
    $id = 0;
    if ($route === '/custom/v1/copy-shopping-list' && !empty($data['success'])) $id = (int) ($data['list']['id'] ?? 0);
    if ($route === '/custom/v1/remove-user-from-shared' && isset($data['listId'])) $id = (int) $data['listId'];
    if ($id) {
        delete_post_meta($id, 'share_code'); delete_post_meta($id, 'share_code_expires'); delete_post_meta($id, 'owner_token');
    }
    return $response;
}, 120, 3);

function lista_private_member_fields($value) {
    if (!is_array($value)) return $value;
    foreach ($value as $key => $item) {
        if (in_array($key, ['user_email', 'user_login', 'user_registered', 'user_url', 'user_nicename'], true)) unset($value[$key]);
        else $value[$key] = lista_private_member_fields($item);
    }
    return $value;
}
add_filter('rest_request_after_callbacks', function ($response, $handler, $request) {
    if (!is_wp_error($response) && preg_match('#^/(custom/v1/(shopping-list|shopping-lists-by-owner|copy-shopping-list)|wp/v2/shopping-list)#i', $request->get_route())) {
        $response = rest_ensure_response($response); $response->set_data(lista_private_member_fields($response->get_data()));
    }
    return $response;
}, 130, 3);
