import { Card } from '@components/atoms'
import Router from 'next/router'

export default function NotFound() {
    return (
        <>
            <div className="container">
                <div className="row justify-content-center">
                    <div className="col-lg-8 text-center noto">
                        <img
                            src="https://static.blex.me/assets/sticker/blank.svg"
                            className="w-75 my-3"
                        />
                        <Card className="p-3 my-3">
                            👀 요청하신 자료는 존재하지 않습니다.
                        </Card>
                        <div className="btn-dark p-3 my-3 c-pointer" onClick={() => Router.push('/')}>
                            👍 집으로 갈까요?
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}