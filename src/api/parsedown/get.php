<?php
    header('Content-Type: text/html; charset=UTF-8');
    include "./parsedown.php";
    
    $text = $_POST['md'];
    //$text = str_replace('<', '&lt;', $text);
    //$text = str_replace('>', '&gt;', $text);

    $parsedown = new Parsedown();
    $result = $parsedown->text($text);
    
    echo $result;
?>