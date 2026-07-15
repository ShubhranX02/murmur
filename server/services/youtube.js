const CATEGORY_MAP = {
  '1': 'Film & Animation',
  '2': 'Autos & Vehicles',
  '10': 'Music',
  '15': 'Pets & Animals',
  '17': 'Sports',
  '19': 'Travel & Events',
  '20': 'Gaming',
  '22': 'People & Blogs',
  '23': 'Comedy',
  '24': 'Entertainment',
  '25': 'News & Politics',
  '26': 'Howto & Style',
  '27': 'Education',
  '28': 'Science & Technology',
  '29': 'Nonprofits & Activism'
};

async function fetchLikedVideos(accessToken) {
  let videos = [];
  let nextPageToken = '';
  let pagesFetched = 0;
  const maxPages = 4; // up to 200 videos

  try {
    while (pagesFetched < maxPages) {
      let url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,topicDetails&myRating=like&maxResults=50`;
      if (nextPageToken) {
        url += `&pageToken=${nextPageToken}`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('YouTube API Error (liked videos):', errorData);
        break;
      }

      const data = await response.json();
      if (data.items && data.items.length > 0) {
        videos = videos.concat(data.items);
      }

      nextPageToken = data.nextPageToken;
      pagesFetched++;

      if (!nextPageToken) {
        break;
      }
    }
  } catch (error) {
    console.error('Error fetching liked videos:', error);
  }

  return videos;
}

async function fetchVideoDetails(videoIds, apiKey) {
  // Not strictly needed since myRating=like returns snippet and topicDetails if requested
  // Keeping this for potential future use or if we need to fetch from a generic playlist
  try {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,topicDetails&id=${videoIds.join(',')}&key=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch video details');
    const data = await response.json();
    return data.items || [];
  } catch (error) {
    console.error('Error fetching video details:', error);
    return [];
  }
}

async function fetchSubscriptions(accessToken) {
  let subscriptions = [];
  let nextPageToken = '';
  let pagesFetched = 0;
  const maxPages = 4; // up to 200 subs

  try {
    while (pagesFetched < maxPages) {
      let url = `https://www.googleapis.com/youtube/v3/subscriptions?part=snippet&mine=true&maxResults=50`;
      if (nextPageToken) {
        url += `&pageToken=${nextPageToken}`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('YouTube API Error (subscriptions):', errorData);
        break;
      }

      const data = await response.json();
      if (data.items && data.items.length > 0) {
        subscriptions = subscriptions.concat(data.items);
      }

      nextPageToken = data.nextPageToken;
      pagesFetched++;

      if (!nextPageToken) {
        break;
      }
    }
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
  }

  return subscriptions;
}

function buildVideoText(video) {
  const snippet = video.snippet || {};
  const title = snippet.title || '';
  const tags = snippet.tags ? snippet.tags.join(', ') : 'none';
  const categoryName = CATEGORY_MAP[snippet.categoryId] || 'Unknown';
  const channelTitle = snippet.channelTitle || '';

  return `${title}. Tags: ${tags}. Category: ${categoryName}. Channel: ${channelTitle}`;
}

module.exports = {
  CATEGORY_MAP,
  fetchLikedVideos,
  fetchVideoDetails,
  fetchSubscriptions,
  buildVideoText
};
