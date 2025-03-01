'use client'
import {useEffect, useState} from 'react';

export default function Home() {
	const [data, setData] = useState([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(null);


	useEffect(() => {
		const fetchData = async() => {
			setLoading(true);
			try {
				const response = await fetch('https://yellowgreen-woodpecker-591324.hostingersite.com/wp-json/wp/v2/posts');
				const data = await response.json();
				setData(data);

			} catch(error) {
				setError(error);
			} finally {
				setLoading(false);
			}

		}

		fetchData().then();
	}, []);


	// Fetch data from API


	return (
		<div>
			<h1>Home</h1>

			{loading && <p>Loading...</p>}

			{error && <p>Error: {error.message}</p>}

			{/*	data is a object*/}

			{data.map((post) => (
				<article key={post.id}>
					<h2>{post.title.rendered}</h2>
					<div dangerouslySetInnerHTML={{__html: post.excerpt.rendered}}></div>
				</article>
			))}
		</div>
	);
}
