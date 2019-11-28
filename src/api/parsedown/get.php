<?php
    include "./parsedown.php";
    
    $text = $_POST['md'];
    //$Text = str_replace('<', '&lt;', $Text);
    //$Text = str_replace('>', '&gt;', $Text);

    $parsedown = new Parsedown();
    $result = $parsedown->text($text);
    
    echo $result;
?>