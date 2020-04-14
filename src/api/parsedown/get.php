<?php
    header('Content-Type: text/html; charset=UTF-8');
    include "./parsedown.php";
    
    $text = $_POST['md'];

    $parsedown = new Parsedown();
    $parsedown->setSafeMode(true);

    $result = $parsedown->text($text);

    // Custom Markdown
    $result = preg_replace(
        '/<p>@gif\[.*\"(https?:\/\/.*\.mp4)\".*\]<\/p>/',
        '<video class="lazy" autoplay muted loop playsinline><source data-src="$1" type="video/mp4"/></video>',
        $result
    );
    $result = preg_replace(
        '/<p>@youtube\[(.*)\]<\/p>/',
        '<iframe width="100%" height="375" src="https://www.youtube.com/embed/$1" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>',
        $result
    );
    $result = preg_replace('/>\[\s\]\s/', '><input type="checkbox" disabled> ', $result);
    $result = preg_replace('/>\[x\]\s/', '><input type="checkbox" disabled checked> ', $result);

    // Allow Markup
    $result = preg_replace('/&lt;br\/?&gt;/', '<br>', $result);
    $result = preg_replace('/&lt;(\/)?center&gt;/', '<$1center>', $result);
    
    echo $result;
?>