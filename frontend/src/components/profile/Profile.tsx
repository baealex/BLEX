import Social, { SocialProps } from "./Social";
import Navigation from "./Navigation";

interface ProfileProps {
    profile: {
        image: string;
        realname: string;
        username: string;
    },
    social: SocialProps;
    active: string;
};

export default function Profile(props: ProfileProps) {
    return (
        <>
            <div className="col-md-12">
                <div className="user-profile">
                    <img className="user-avatar" src={props.profile.image}/>
                    <h4 className="noto username">{props.profile.realname}</h4>
                    <h5 className="noto">@{props.profile.username}</h5>
                    <Social {...props.social}/>
                </div>
            </div>
            <Navigation active={props.active} username={props.profile.username}/>
        </>
    )
}