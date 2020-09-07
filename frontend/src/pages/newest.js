import Head from 'next/head'
import axios from 'axios'
import ArticleCard from '../components/article/ArticleCard'

import API from '../modules/api'

export async function getServerSideProps(context) {
    let { page } = context.query;
    page = page ? page : 1;
    const { data } = await API.getAllPosts('newest', page);
    return { props: { data, page } }
}

class Home extends React.Component {
    render() {
        return (
            <>
                <Head>
                    <title>BLOG EXPRESS ME</title>
                </Head>

                <div className="container">
                    <div className="row">
                        {this.props.data.items.map((item, idx) => (
                            <ArticleCard
                                key={idx}
                                title={item.title}
                                url={item.url}
                                author={item.author}
                                image={item.image}
                            />
                        ))}
                    </div>
                </div>
            </>
        )
    }
}

export default Home;