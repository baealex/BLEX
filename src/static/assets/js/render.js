var Render = {
    story: (element) => {
        if (element.created_date == element.updated_date)
            var date = element.created_date;
        else
            var date = `${element.created_date}(Last Update: ${element.updated_date})`;
        return `
        <div class="card story-card">
            <div class="card-header">
                <div class="d-flex justify-content-between align-items-center">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <div class="back-image thumb comment-thumb" style="background-image:url(${element.thumbnail})"></div>
                        </div>
                        <div>
                            <div class="h6 noto story-title m-0">${element.title}</div>
                            <div class="h7 text-muted">@${element.author}</div>
                        </div>
                    </div>
                    <div>
                        <div class="text-muted h7 mb-2"> <i class="fa fa-clock-o"></i>0분 전</div>
                    </div>
                </div>
            </div>
            <div class="card-body">
                <div class="article">
                    ${element.content}
                </div>
            </div>
            <div class="card-footer">
                <a class="card-link shallow-dark" href="#"><i class="fas fa-chevron-down"></i></a>
                <a class="card-link shallow-dark" href="javascript:void(0)" onclick="Story.edit(${element.pk})"><i class="far fa-edit"></i></a>
                <a class="card-link shallow-dark" href="javascript:void(0)" onclick="Story.remove(${element.pk});"><i class="far fa-trash-alt"></i></a>
            </div>
        </div>
        `
    },
    comment: (element) => {
        return `
        <div class="comment-list s-shadow">
            <div class="back-image thumb comment-thumb" style="background-image:url(${element.thumbnail})"></div>
            <a class="font-weight-bold deep-dark">${element.author}</a>
            <br>
            <small>${element.created_date}전 <span class="vs">${element.edited}</span></small>
            <ul class="none-list">
                <li><a class="vs shallow-dark" href="javascript:void(0)" onclick="Comment.edit(${element.pk})">수정</a></li>
                <li><a class="vs shallow-dark" href="javascript:void(0)" onclick="Comment.remove(${element.pk});">삭제</a></li>
            </ul>
            <div class="mt-3 noto">${element.content}</div>
            <ul class="none-list">
                <li>
                    <a class="shallow-dark" href="javascript:void(0);" onclick="Comment.like(${element.pk})">
                        <i class="fas fa-angle-up"></i> <span id="clc${element.pk}">${element.total_likes}</span>
                    </a>
                </li>
            </ul>
        </div>`
    },
    analytics: {
        element: (element, type) => {
            let actionClass = '';
            let elementSub = '';
            if(type == 'posts') {
                actionClass = 'Posts';
                elementSub = `
                    <li><i class="far fa-thumbs-up"></i> ${element.total_likes}</li>
                    <li><i class="far fa-comment"></i> ${element.total_comment}</li>
                    <li><i class="fas fa-chart-line"></i> ${element.trendy}</li>
                `;
            } else {
                actionClass = 'Thread';
                elementSub = `
                    <li><i class="far fa-bookmark"></i> ${element.total_bookmark}</li>
                    <li><i class="far fa-comment"></i> ${element.total_story}</li>
                `;
            }

            let hideState = 'fa-lock-open';
            if(element.hide) {
                hideState = 'fa-lock';
            }
            return `
            <li id="setting-${type}-${element.pk}" class="card p-3 mb-2">
            <p><a class="deep-dark" href="javascript:void(0)" onclick="location.href='${element.url}'">${element.title}</p>
            <ul class="setting-list-info">
                <li><a class="element-lock" href="javascript:${actionClass}.lock(${element.pk})"><i id="lock-${element.pk}" class="fas ${hideState}"></i></a></li>
                <li><a class="text-dark" href="javascript:${actionClass}.remove(${element.pk})"><i class="far fa-trash-alt"></i></a></li>
                <li>|</li>
                <li><i class="far fa-eye"></i> <span class="ns">(Today : ${element.today}, Yesterday : ${element.yesterday}, Total : ${element.today+element.yesterday+element.total})</span></li>
                ${elementSub}
            </ul>
            <form>
                <div class="input-group mt-2 mr-sm-2">
                    <div class="input-group-prepend">
                        <div class="input-group-text">TAG</div>
                    </div>
                    <input type="text" name="tag" value="${element.tag}" class="form-control" maxlength="255">
                    <button type="button" class="btn btn-dark" onclick="${actionClass}.changeTag(${element.pk})">
                        변경
                    </button>
                </div>
            </form>
        </li>
        `}
    },
    notify: {
        common: (element) => {
            return `
            <div id="pretoast${element.pk}" class="toast" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="toast-header">
                    <img src="https://static.blex.me/assets/images/logo.png" class="rounded mr-2" width="20px">
                    <strong class="mr-auto">알림</strong>
                    <button type="button" class="ml-2 mb-1 close" data-dismiss="toast" aria-label="Close">
                        <span aria-hidden="true">&times;</span>
                    </button>
                </div>
                <div class="toast-body">
                    ${element.info}
                </div>
            </div>
            `
        },
        reguler: (element) => {
            return `
            <div id="toast${element.pk}" class="toast" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="toast-header">
                    <img src="https://static.blex.me/assets/images/logo.png" class="rounded mr-2" width="20px">
                    <strong class="mr-auto">알림</strong>
                    <small class="text-muted">${element.created_date}전</small>
                    <button type="button" class="ml-2 mb-1 close" data-dismiss="toast" aria-label="Close" onclick="Notify.read(${element.pk})">
                        <span aria-hidden="true">&times;</span>
                    </button>
                </div>
                <div class="toast-body">
                    <a class="deep-dark" href="/api/v1/notify?id=${element.pk}">${element.infomation}</a>
                </div>
            </div>
            `
        }
    }
}