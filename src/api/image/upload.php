<?php

header('Access-Control-Allow-Origin: *');

include "../randstr/randstr.php";

umask(0);

$year = date("Y");
$month = date("m");
$day = date("d");

$uploads_url = 'https://static.blex.kr/image';
$allowed_ext = array('jpg', 'jpeg', 'png', 'gif');

$filePath = "./count.txt";
$count = file($filePath);
$count = trim($count[0]);

$uploads_dir = '../../static/image';
if(!is_dir($uploads_dir.'/'.$year)) {
    mkdir($uploads_dir.'/'.$year, 0777);
}
if(!is_dir($uploads_dir.'/'.$year.'/'.$month)) {
    mkdir($uploads_dir.'/'.$year.'/'.$month, 0777);
}
if(!is_dir($uploads_dir.'/'.$year.'/'.$month.'/'.$day)) {
	mkdir($uploads_dir.'/'.$year.'/'.$month.'/'.$day, 0777);
	$count = 0;
}
$uploads_dir = $uploads_dir.'/'.$year.'/'.$month.'/'.$day;

$name = $_FILES['image']['name'];
$error = $_FILES['image']['error'];
$ext = strtolower(array_pop(explode('.', $name)));

if(!in_array($ext, $allowed_ext)) {
	echo "허용되지 않는 확장자입니다.";
	exit;
}

if( $error != UPLOAD_ERR_OK ) {
	switch( $error ) {
		case UPLOAD_ERR_INI_SIZE:
		case UPLOAD_ERR_FORM_SIZE:
			echo "파일이 너무 큽니다. ($error)";
			break;
		case UPLOAD_ERR_NO_FILE:
			echo "파일이 첨부되지 않았습니다. ($error)";
			break;
		default:
			echo "파일이 제대로 업로드되지 않았습니다. ($error)";
	}
	exit;
}

$new_name = $count.'_'.randstr(15);

if(move_uploaded_file($_FILES['image']['tmp_name'], $uploads_dir.'/'.$new_name.'.'.$ext)){
	if($ext == 'gif') {
		shell_exec('ffmpeg -i '.$uploads_dir.'/'.$new_name.'.'.$ext.' -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" -c:v libx264 -pix_fmt yuv420p -movflags +faststart  '.$uploads_dir.'/'.$new_name.'.mp4');
		shell_exec('rm '.$uploads_dir.'/'.$new_name.'.'.$ext);
		$ext = 'mp4';
	}
    echo $uploads_url.'/'.$year.'/'.$month.'/'.$day.'/'.$new_name.'.'.$ext;
} else {
    echo "이미지 업로드를 실패하였습니다.";
}

$count++;

$fp = fopen($filePath, "w");
fwrite($fp, $count);
fclose($fp);

?>