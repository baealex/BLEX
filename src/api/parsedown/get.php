<?php
    include "./parsedown.php";
    
    $Text = $_POST['Text'];
    //$Text = str_replace('<', '&lt;', $Text);
    //$Text = str_replace('>', '&gt;', $Text);

    $Parsedown = new Parsedown();
    $ParseText = $Parsedown->text($Text);
    
    echo $ParseText;
?>