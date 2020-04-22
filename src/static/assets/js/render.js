var Render = {
    write: (elements) => {
        var list = '';
        elements.map(function(element) {
            list += `<li><a href="/write?token=${element.token}">${element.title} (${element.date} 전)</a></li>`;
        });
        return `
        <div class="full-mask blurring write-closer">
            <div class="center-list">
                <ul class="serif">
                    ${list}
                    <li><a href="/write">새 글 쓰기</a></li>
                    <li><a class="write-closer" href="javascript:void(0);">닫기</a></li>
                </ul>
            </div>
        </div>
        `
    },
    story: (element) => {
        if (element.created_date == element.updated_date)
            var date = element.created_date;
        else
            var date = `${element.created_date}(Last Update: ${element.updated_date})`;
        return `
        <div class="card story-card blex-card">
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
                        <div class="text-muted h7 mb-2"><i class="far fa-clock"></i> 0분 전</div>
                    </div>
                </div>
            </div>
            <div class="card-body">
                <div class="article">
                    ${element.content}
                </div>
            </div>
            <div class="card-footer">
                <a class="card-link shallow-dark agree" href="javascript:void(0)" onclick="Story.agree(${element.pk})">
                    <i class="far fa-thumbs-up"></i> <span>${element.agree}</span>
                </a>
                <a class="card-link shallow-dark disagree" href="javascript:void(0)" onclick="Story.disagree(${element.pk})">
                    <i class="far fa-thumbs-up fa-rotate-180"></i> <span>${element.disagree}</span>
                </a>
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
            if(type == 'posts_analytics') {
                actionClass = 'Posts';
                elementSub = `
                    <li><i class="far fa-thumbs-up"></i> ${element.total_likes}</li>
                    <li><i class="far fa-comment"></i> ${element.total_comment}</li>
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
            <li id="item-${element.pk}" class="blex-card p-3 mb-3" data-aos="zoom-in">
            <p class="noto"><a class="deep-dark" href="javascript:void(0)" onclick="location.href='${element.url}'">${element.title}</a></p>
            <ul class="setting-list-info">
                <li><a class="element-lock" href="javascript:${actionClass}.lock(${element.pk})"><i class="fas ${hideState}"></i></a></li>
                <li><a class="text-dark" href="javascript:${actionClass}.remove(${element.pk})"><i class="far fa-trash-alt"></i></a></li>
                <li>|</li>
                <li><i class="far fa-eye"></i> <span class="ns">(Today : ${element.today}, Yesterday : ${element.yesterday}, Total : ${element.total})</span></li>
                <li><a class="shallow-dark" href="javascript:void(0)" onclick="Analytics.modal('${element.author}', '${type}', '${element.pk}');"><i class="fas fa-chart-line"></i> <span class="ns">More</li></a></li>
                ${elementSub}
            </ul>
            <form>
                <div class="input-group mt-2 mr-sm-2">
                    <div class="input-group-prepend">
                        <div class="input-group-text">#</div>
                    </div>
                    <input type="text" name="tag" value="${element.tag}" class="form-control" maxlength="255">
                    <button type="button" class="btn btn-dark" onclick="${actionClass}.changeTag(${element.pk})">
                        <i class="fas fa-sign-in-alt"></i>
                    </button>
                </div>
            </form>
        </li>
        `},
        modal: (elements, pk) => {
            var content = `<ul class="list-group list-group-flush">`;
            elements.map(function(element) {
                content += `<li class="list-group-item">${element.time} - ${decodeURI(element.from)}</li>`
            });
            content += `</ul>`
            return `
            <div class="modal fade noto" id="item-${pk}-detail" tabindex="-1" role="dialog" aria-hidden="true">
                <div class="modal-dialog modal-lg" role="document">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title noto">동향 분석</h5>
                            <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                                <span aria-hidden="true">&times;</span>
                            </button>
                        </div>
                        <div class="modal-body">
                            <div id="chart-${pk}" style="width:100%; height:500px;"></div>
                            ${content}
                        </div>
                    </div>
                </div>
            </div>
            `
        }
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
                    <button type="button" class="ml-2 mb-1 close" data-dismiss="toast" aria-label="Close" onclick="Notify.read('${element.user}', ${element.pk})">
                        <span aria-hidden="true">&times;</span>
                    </button>
                </div>
                <div class="toast-body">
                    <a class="deep-dark" href="javascript:void(0)" onclick="Notify.go('${element.user}', ${element.pk})">${element.infomation}</a>
                </div>
            </div>
            `
        }
    }
}