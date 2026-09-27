<?php
// Isolated endpoint checks. No WordPress instance or real account is contacted.
define('ABSPATH', __DIR__);
class WP_Error { public $code; function __construct($code, $message='', $data=[]) {$this->code=$code;} }
class WP_REST_Request { function get_param($key) { return 'test.account.token'; } }
class FakeDB {
    public $prefix='wp_'; public $released=0;
    function prepare($query, $value) { return $query; }
    function get_var($query) { if (strpos($query,'RELEASE_LOCK')!==false) $this->released++; return 1; }
}
$wpdb=new FakeDB(); $guest=7; $destination=9; $identityStatus=200; $failPost=0;
$userMeta=[7=>[],9=>[],10=>['registered'=>'yes']];
$lists=[1=>['owner_id'=>7,'order'=>0,'products'=>[22,23],'bagged'=>[23],'shared'=>[10]],2=>['owner_id'=>9,'order'=>5,'products'=>[44]],3=>['owner_id'=>10,'order'=>2,'shared'=>[7]]];
function add_action($name,$cb){if($name==='rest_api_init')$cb();else $GLOBALS['hooks'][$name]=$cb;}
function register_rest_route($namespace,$route,$args){$GLOBALS['route']=$args;}
function get_current_user_id(){return $GLOBALS['guest'];}
function get_user_meta($id,$key,$single){return $GLOBALS['userMeta'][$id][$key]??'';}
function update_user_meta($id,$key,$value){$GLOBALS['userMeta'][$id][$key]=$value;}
function absint($id){return abs((int)$id);}
function rest_url($path){return 'https://example.test/wp-json/'.$path;}
function wp_remote_get($url,$args){check($args['redirection']===0,'credentials cannot follow redirects');return ['status'=>$GLOBALS['identityStatus'],'body'=>json_encode(['id'=>$GLOBALS['destination']])];}
function wp_remote_retrieve_response_code($value){return $value['status'];}
function wp_remote_retrieve_body($value){return $value['body'];}
function get_userdata($id){return $id?(object)['ID'=>$id,'display_name'=>'Account','user_pass'=>$id===9?'registered-hash':'guest-hash','user_email'=>'user@example.test']:false;}
function is_email($email){return str_contains($email, '@');}
function wp_check_password($password,$hash,$id){return $hash==='guest-hash';}
function is_wp_error($value){return $value instanceof WP_Error;}
function get_posts($args){
    $result=[];
    foreach($GLOBALS['lists'] as $id=>$list){
        $owner=$args['meta_value']??$GLOBALS['destination'];
        if($list['owner_id']!==$owner)continue;
        $result[]=(object)['ID'=>$id,'menu_order'=>$list['order']];
    }
    usort($result,fn($a,$b)=>$args['order']==='DESC'?$b->menu_order-$a->menu_order:$a->menu_order-$b->menu_order);
    return $args['posts_per_page']===1?array_slice($result,0,1):$result;
}
function get_post_meta($id,$key,$single){return $GLOBALS['lists'][$id][$key]??'';}
function wp_update_post($data,$error){if($GLOBALS['failPost']===$data['ID'])return new WP_Error('failed');$GLOBALS['lists'][$data['ID']]['order']=$data['menu_order'];$GLOBALS['lists'][$data['ID']]['author']=$data['post_author'];return $data['ID'];}
function update_field($key,$value,$id){$GLOBALS['lists'][$id][$key]=$value;}
function rest_ensure_response($data){return $data;}
function check($value,$message){if(!$value)throw new Exception($message);}
require __DIR__.'/../WP/list/claim-guest-lists.php';
$request=new WP_REST_Request();
check($route['permission_callback']()===true,'guest permitted');
$userMeta[9]['registered']='yes';$guest=9;check(is_wp_error($route['permission_callback']()),'registered source rejected');$guest=7;$userMeta[9]['registered']='';
$hooks['profile_update'](9,(object)['user_email'=>'user@example.test','user_pass'=>'guest-hash']);
check($userMeta[9]['registered']==='','password-only update does not mark registration');
$hooks['profile_update'](9,(object)['user_email'=>'old@example.test','user_pass'=>'guest-hash']);
check($userMeta[9]['registered']==='yes','registration transition sets marker');$userMeta[9]['registered']='';
$identityStatus=403;check(is_wp_error(lista_claim_guest_lists($request)),'bad account token rejected');check($lists[1]['owner_id']===7,'auth failure leaves lists untouched');$identityStatus=200;
$destination=10;$userMeta[10]['registered']='';check(is_wp_error(lista_claim_guest_lists($request)),'default-password guest cannot receive lists');$userMeta[10]['registered']='yes';$destination=9;
$failPost=1;check(is_wp_error(lista_claim_guest_lists($request)),'write failure reported');check($lists[1]['owner_id']===7,'failed row retains guest ownership');$failPost=0;
check($userMeta[9]['registered']==='yes','existing registered account marker repaired');
$result=lista_claim_guest_lists($request);
check($result['transferred_count']===1,'one owned list transferred');
check($lists[1]['owner_id']===9 && $lists[1]['author']===9,'owner and author updated');
check($lists[1]['order']>5,'appended after existing account lists');
check($lists[1]['products']===[22,23] && $lists[1]['bagged']===[23] && $lists[1]['shared']===[10],'contents and sharing preserved');
check($lists[2]['products']===[44] && $lists[3]['owner_id']===10,'other lists untouched');
check($lists[1]['owner_token']==='','account JWT never stored');
check(lista_claim_guest_lists($request)['transferred_count']===0,'retry is idempotent');
$destination=10;check(is_wp_error(lista_claim_guest_lists($request)),'retry cannot change destination');
check($wpdb->released===4,'all acquired locks released including errors');
echo "Guest transfer checks passed\n";
