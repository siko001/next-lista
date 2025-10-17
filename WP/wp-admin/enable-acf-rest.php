<?php
// Enable ACF fields to be accessible via the REST API
add_filter('acf/rest_api/field_settings/show_in_rest', '__return_true');
add_filter('acf/rest_api/field_settings/edit_in_rest', '__return_true');
