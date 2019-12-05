class InfiniteScroll {
    constructor (path, wrapperId, rastPage) {
        if (path === undefined || wrapperId === undefined) throw Error ('no parameter.');
        this.path = path;
        this.pNum = 2;
        this.wNode = document.getElementById(wrapperId);
        this.wrapperId = wrapperId;
        this.rastPage = rastPage;
        this.enable = true;

        this.detectScroll();
    }

    detectScroll() {
        window.onscroll = (ev) => {
            if ((window.innerHeight + window.pageYOffset) >= document.body.offsetHeight && this.pNum <= this.rastPage) 
                this.getNewPost();
        };    
    }

    getNewPost() {
        if (this.enable === false) return false;
        this.enable = false;
        const xmlhttp = new XMLHttpRequest();
        xmlhttp.onreadystatechange = () => {
            if (xmlhttp.readyState == XMLHttpRequest.DONE) {
                if (xmlhttp.status == 200) {
                    this.pNum++;
                    const childItems = this.getChildItemsByAjaxHTML(xmlhttp.responseText);
                    this.appendNewItems(childItems);
                }
                return this.enable = true;
            }
        }
        xmlhttp.open("GET", `${location.origin + this.path + this.pNum}`, true);
        xmlhttp.send();
    }

    getChildItemsByAjaxHTML(HTMLText) {
        const newHTML = document.createElement('html');
        newHTML.innerHTML = HTMLText;
        const childItems = newHTML.querySelectorAll(`#${this.wrapperId} > *`);
        return childItems;
    }

    appendNewItems(items) {
        items.forEach(item => {
            this.wNode.appendChild(item);
        });
    }
}

$(document).ready(function() {
    if(getCookie('latelyposition')) {
        $('#return-position').css('display', 'block');
        var desPos = getCookie('latelyposition');
        var count = 0;
        var findLatelyPosition = setInterval(function() {
            var nowPos = $(document).scrollTop();
            if(nowPos < desPos - 10) {
                $(document).scrollTop(desPos);
                count += 1;
                if(count > 100) {
                    clearTimeout(findLatelyPosition);
                    $('#return-position').remove();
                    distoryLatelyPosition();    
                }
            } else {
                clearTimeout(findLatelyPosition);
                $('#return-position').remove();
                distoryLatelyPosition();
            }
        }, 50);
    } else {
        $('#return-position').remove();
    }
});