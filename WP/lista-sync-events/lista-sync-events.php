<?php
/**
 * Plugin Name: Lista Sync Events
 * Description: Notifies every affected account after successful Lista REST writes, including list creation and ordering.
 * Version: 1.0.0
 * Requires PHP: 7.4
 */

if (!defined('ABSPATH')) exit;

final class Lista_Sync_Events {
    private $before = [];
    private $pending = [];

    public function __construct() {
        add_filter('rest_request_before_callbacks', [$this, 'before_write'], 10, 3);
        add_filter('rest_request_after_callbacks', [$this, 'after_write'], 100, 3);
        add_action('shutdown', [$this, 'publish'], 100);
        add_action('admin_notices', [$this, 'configuration_notice']);
    }

    private function is_list_write($request) {
        if (!in_array($request->get_method(), ['POST', 'PUT', 'PATCH', 'DELETE'], true)) return false;
        $route = rtrim($request->get_route(), '/');
        if (preg_match('#^/wp/v2/shopping-list(?:/\d+|/order)?$#', $route)) return true;
        return (bool) preg_match('#^/custom/v1/(?:update-shopping-list|bag-all-products|unbag-all-products|remove-checked-products|remove-bagged-products|copy-shopping-list|claim-guest-lists|share-list|accept-shared-list|remove-user-from-shared|delete-custom-product|empty/\d+)$#', $route);
    }

    private function list_ids($request, $data = []) {
        $ids = [];
        foreach (['id', 'listId', 'list_id', 'shoppingListId', 'shopping_list_id', 'source_list_id'] as $key) {
            $value = $request->get_param($key);
            if (is_scalar($value)) $ids[] = absint($value);
        }
        foreach ((array) $request->get_param('orders') as $order) {
            if (is_array($order) && isset($order['id'])) $ids[] = absint($order['id']);
        }
        if (is_array($data)) {
            foreach (['id', 'list_id', 'listId'] as $key) {
                if (isset($data[$key]) && is_scalar($data[$key])) $ids[] = absint($data[$key]);
            }
            if (isset($data['list']['id'])) $ids[] = absint($data['list']['id']);
            foreach ((array) ($data['list_ids'] ?? []) as $id) {
                if (is_scalar($id)) $ids[] = absint($id);
            }
        }
        return array_values(array_filter(array_unique($ids), function($id) {
            return $id > 0 && get_post_type($id) === 'shopping-list';
        }));
    }

    private function recipients($ids) {
        $users = [];
        if (!function_exists('get_field')) return $users;
        foreach ($ids as $id) {
            $users[] = absint(get_field('owner_id', $id));
            foreach ((array) get_field('shared_with_users', $id) as $user) {
                $users[] = absint(is_array($user) ? ($user['ID'] ?? 0) : (is_object($user) ? ($user->ID ?? 0) : $user));
            }
        }
        return array_values(array_filter(array_unique($users)));
    }

    public function before_write($response, $handler, $request) {
        if ($this->is_list_write($request)) {
            // Retain former members before a removal or deletion changes access.
            $this->before[spl_object_hash($request)] = $this->recipients($this->list_ids($request));
        }
        return $response;
    }

    public function after_write($response, $handler, $request) {
        if (!$this->is_list_write($request)) return $response;
        $key = spl_object_hash($request);
        $previous = $this->before[$key] ?? [];
        unset($this->before[$key]);
        if (is_wp_error($response)) return $response;
        $result = rest_ensure_response($response);
        if (is_wp_error($result) || $result->get_status() < 200 || $result->get_status() >= 300) return $response;
        $data = $result->get_data();
        if (is_array($data) && (isset($data['error']) || (isset($data['success']) && !$data['success']))) return $response;
        $users = array_merge($previous, $this->recipients($this->list_ids($request, $data)), [get_current_user_id()]);
        foreach ($users as $id) if ($id > 0) $this->pending[(int) $id] = true;
        return $response;
    }

    public function publish() {
        $users = array_keys($this->pending);
        $this->pending = [];
        if (!$users) return;
        if (!function_exists('setup_pusher')) {
            error_log('Lista Sync Events: activate the existing Lista Realtime Updates plugin (setup_pusher is missing).');
            return;
        }
        try {
            // Reuse the existing server-side configuration. Never put Pusher
            // credentials or account/list contents in a client event.
            $pusher = setup_pusher();
        } catch (Throwable $error) {
            error_log('Lista Sync Events: publishing failed; check the existing Pusher configuration and server connectivity.');
            return;
        }
        foreach ($users as $id) {
            try {
                $pusher->trigger('user-lists-' . $id, 'lists-changed', ['event_id' => wp_generate_uuid4()]);
            } catch (Throwable $error) {
                // A failure for one recipient must not skip everyone else.
                error_log('Lista Sync Events: publishing failed; check the existing Pusher configuration and server connectivity.');
            }
        }
    }

    public function configuration_notice() {
        if (function_exists('setup_pusher') || !current_user_can('activate_plugins')) return;
        echo '<div class="notice notice-error"><p>Lista Sync Events requires the existing Lista Realtime Updates plugin with its setup_pusher() function.</p></div>';
    }
}

new Lista_Sync_Events();
