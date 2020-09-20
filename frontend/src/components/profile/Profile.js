import Social from "./Social";
import Navigation from "./Navigation";

export default function Profile(props) {
    return (
        <>
            <div className="col-md-12">
                <div className="user-profile">
                    <img className="user-avatar blur-off" src={props.profile.image}/>
                    <h4 className="serif username">{props.profile.realname}</h4>
                    <h5 className="serif">@{props.profile.username}</h5>
                    <Social {...props.social}/>
                </div>
            </div>
            <Navigation username={props.profile.username}/>
        </>
    )
}