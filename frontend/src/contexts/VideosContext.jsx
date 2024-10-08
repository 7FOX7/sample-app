import { useState, createContext, useContext } from "react";
import axios from "axios";

const VideosContext = createContext(null); 

export const VideosProvider = ({children}) => {
    const [videos, setVideos] = useState(null); 

    async function fetchVideos() {
        try {
            const response = await axios.get('http://localhost:8080/videos'); 
            setVideos(response.data)
            console.log('videos were fetched successfully: ' +  response.statusText)
        }
        catch (err) {
            if(err.response) {
                console.log('Something is wrong with the server: ' + err.response.data)
            }
            else if(err.request) {
                console.log('Something is wrong with the client')
            }
            else {
                console.log(err)
            }
        }
    }

    return <VideosContext.Provider value={{videos, fetchVideos}}>{children}</VideosContext.Provider>
}

export const useVideos = () => {
    return useContext(VideosContext)
}