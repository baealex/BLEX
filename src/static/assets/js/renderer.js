var render = {
    story: (element) => {
        if (element.created_date == element.updated_date)
            var date = element.created_date;
        else
            var date = `${element.created_date}(Last Update: ${element.updated_date})`;
        return `
        <div id="story-${element.pk}" class="thread-card p-4">
            <p class="serif"><strong>${element.title}</strong></p>
            <a href="">
                <div class="back-image thumb comment-thumb" style="background-image:url(${element.thumbnail})"></div>
            </a>
            <a class="font-weight-bold deep-dark" href="">@${element.author}</a>
            <br>
            <small>${date}</small>
            <ul class="none-list">
                <li><a class="vs shallow-dark" href="javascript:void(0)" onclick="story.edit(${element.pk})">수정</a></li>
                <li><a class="vs shallow-dark" href="javascript:void(0)" onclick="story.remove(${element.pk});">삭제</a></li>
            </ul>
            <div class="article">
                ${element.content}
            </div>
        </div>
        `
    },
}