const express = require('express'); 
const mysql2 = require('mysql2'); 
const cors = require('cors'); 
const dotenv = require('dotenv');
const multer = require('multer');
const sharp = require('sharp'); 
const Cron = require('croner');  
const {Storage} = require('@google-cloud/storage'); 

const upload = multer({
    storage: multer.memoryStorage(), 
    limits: {
        fileSize: 25 * 1024 * 1024
    }
})

const app = express(); 
app.use(express.json()); 
dotenv.config(); 
app.use(cors({
    origin: "http://localhost:3000", 
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"]
})); 

app.listen(8080, () => {
    console.log('Server listening on port 8080')
})

app.get('/', (req, res) => {
    res.send('Hello from server')
})

const db = mysql2.createConnection({
    host: "localhost", 
    user: "root", 
    password: process.env.DB_PASSWORD, 
    database: "testdb", 
    port: 3306
})

const storage = new Storage({
    projectId: process.env.PROJECT_ID, 
    keyFilename: process.env.KEY_FILE_NAME
})

const bucket = storage.bucket(process.env.BUCKET_NAME)

app.get('/users', (req, res) => {
    const q = "SELECT * FROM users"; 
    db.query(q, (err, data) => {
        if(err) {
            res.status(500).send('There was an error when setting a query: ' + err)
        }
        else {
            res.json(data)
        } 
    })
})

app.post('/users', (req, res) => {
    const {username, password} = req.body; 
    const q = `INSERT INTO users (username, password) VALUES (?, ?)`
    db.query(q, [username, password], (err) => {
        if(err) {
            return res.status(500).send('There was an error when setting a query: ' + err)
        }
        const q2 = `SELECT * FROM users`
        db.query(q2, (err, data) => {
            if(err) {
                return res.status(500).send('There was an error when setting a query: ' + err)
            }
            res.status(200).json(data)
        })
    })
})

app.get('/posts', (req, res) => {
    const q = `
        SELECT posts.id, posts.publishDate, posts.content, posts.imageUrl, posts.likes, posts.latitude, posts.longitude, users.username FROM posts
        JOIN users ON users.id = posts.userId
    `
    db.query(q, (err, data) => {
        if(err) {
            res.status(500).send('There was an error when setting a query: ' + err)
        }
        else {
            res.json(data)
        }
    })
})

app.post('/posts', (req, res) => {
    const {publishDate, content, imageUrl, userId, likes, latitude, longitude} = req.body; 
    const q = `INSERT INTO posts (publishDate, content, imageUrl, userId, likes, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, ?)`
    db.query(q, [publishDate, content, imageUrl, userId, likes, latitude, longitude], (err) => {
        if(err) {
            return res.status(500).send('There was an error when setting a query: ' + err)
        }
        const q2 = `
            SELECT posts.id, posts.publishDate, posts.content, posts.imageUrl, posts.userId, posts.likes, posts.latitude, posts.longitude, users.username FROM posts
            JOIN users ON users.id = posts.userId
            ORDER BY id DESC
            LIMIT 1
            `
        db.query(q2, [content], (err, data) => {
            if(err) {
                return res.status(500).send('There was an error when setting a query: ' + err)
            }
            res.status(200).json(data)
        })
    })
})

app.post('/upload', upload.single("image"), async (req, res) => {
    if(!req.file) {
        return res.status(500).send('Please, select a file')
    }

    try {
        const processImageBuffer = sharp(req.file.buffer)
            .toFormat('webp')
            .resize(380)
            .toBuffer()
            .then((data) => {
                const blob = bucket.file(req.file.originalname)
                const blobStream = blob.createWriteStream({
                    resumable: false, 
                    contentType: "image/webp"
                })
                blobStream.on('error', (err) => {
                    res.status(500).send(err.message)
                })
                blobStream.on('finish', () => {
                    const publicUrl = `https://storage.cloud.google.com/${bucket.name}/${blob.name}`
                    res.status(200).json(publicUrl)
                })
                blobStream.end(data)
            })
    }
    catch(err) {
        if(err.code === "LIMIT_FILE_SIZE") {
            return res.status(500).send('File size cannot be larger than 25MB!')
        }
        res.status(500).send(err)
    }
})

app.get('/clubs', (req, res) => {
    const q = 'SELECT * FROM clubs'; 
    db.query(q, (err, data) => {
        if(err) {
            return res.status(500).send('There was an error when setting a query: ' + err)
        }
        else {
            res.status(200).json(data)
        }
    })
})

app.get('/user-clubs', (req, res) => {
    const q = 'SELECT * FROM user_clubs'; // not using 'SELECT clubId FROM user_clubs' because eventually going to use 'map' anyway
    db.query(q, (err, data) => {
        if(err) {
            return res.status(500).send('There was an error when setting a query: ' + err)
        }
        else {
            res.status(200).json(data)
        }
    })
})

app.post('/user-clubs', (req, res) => {
    const {userId, clubId, join} = req.body; 
    const q1 = join ? 'UPDATE clubs SET members = members + 1 WHERE id=?' : 'UPDATE clubs SET members = members - 1 WHERE id=?'
    db.query(q1, [clubId], (err) => {
        if(err) {
            return res.status(500).send('There was an error when setting a q1: ' + err)
        }
        else {
            const q2 = join ? 'INSERT INTO user_clubs (userId, clubId) VALUES(?, ?)' : 'DELETE FROM user_clubs WHERE userId=? AND clubId=?'; 
            db.query(q2, [userId, clubId], (err) => {
                if(err) {
                    return res.status(500).send('There was an error when setting a q2: ' + err)
                }
                else {
                    const q3 = 'SELECT * FROM user_clubs'; 
                    db.query(q3, (err, data) => {
                        if(err) {
                            return res.status(500).send('There was an error when setting a q3: ' + err)
                        }
                        else {
                            res.status(200).json(data)
                        }
                    })
                }
            })
        }
    })
})

app.get('/likes', (req, res) => {
    const {userId, postId, getAll} = req.query
    const q = getAll ? `
        SELECT * FROM liked_posts
        RIGHT JOIN posts ON posts.id = liked_posts.postId
        WHERE liked_posts.userId=?
    ` : 
    `
        SELECT postId FROM liked_posts
        WHERE userId=? AND postId=?
    `
    db.query(q, [userId, postId], (err, data) => {
        if(err) {
            return res.status(500).send('There was an error when setting a query: ' + err)
        }
        else {
            return res.status(200).send(data)
        }
    })
})

app.post('/likes', (req, res) => {
    const {userId, postId, isLiked} = req.body; 
    if(!isLiked) {
        const q = `INSERT INTO liked_posts (userId, postId) VALUES(?, ?)`   
        db.query(q, [userId, postId], (err) => {
            if(err) {
                return res.status(500).send('There was an error when setting a query: ' + err)
            }    
            const q2 = `UPDATE posts SET likes = likes + 1 WHERE id=?`
            db.query(q2, [postId], (err) => {
                if(err) {
                    return res.status(500).send('There was an error when setting a query: ' + err)
                }  
                const q3 = `SELECT likes FROM posts WHERE id=?`
                db.query(q3, [postId], (err, data) => {
                    if(err) {
                        return res.status(500).send('There was an error when setting a query: ' + err)
                    }   
                    res.status(200).json(data) 
                })  
            })
        })  
    }
    else {
        const q = `DELETE FROM liked_posts WHERE userId=? AND postId=?`   
        db.query(q, [userId, postId], (err) => {
            if(err) {
                return res.status(500).send('There was an error when setting a query: ' + err)
            }    
            const q2 = `UPDATE posts SET likes = likes - 1 WHERE id=?`
            db.query(q2, [postId], (err) => {
                if(err) {
                    return res.status(500).send('There was an error when setting a query: ' + err)
                }  
                const q3 = `SELECT likes FROM posts WHERE id=?`
                db.query(q3, [postId], (err, data) => {
                    if(err) {
                        return res.status(500).send('There was an error when setting a query: ' + err)
                    }   
                    res.status(200).json(data) 
                })  
            })
        })
    }
})

app.get('/videos', (req, res) => {
    const q = `
        SELECT videos.id, publishDate, videoUrl, users.username FROM videos
        JOIN users ON users.id = videos.userId
    `; 
    db.query(q, (err, data) => {
        if(err) {
            return res.status(500).send('There was an error when setting a query: ' + err)
        }
        else {
            res.json(data)
        }
    })
})

app.post('/videos', (req, res) => {
    const {publishDate, videoUrl, userId} = req.body; 
    const q1 = `SELECT COUNT(*) AS count FROM videos`
    db.query(q1, (err, data) => {
        if(err) {
            return res.status(500).send('There was an error when setting a q1: ' + err)
        }
        else {
            const count = data[0].count
            if(typeof(count) === "number") {
                const q2 = count === 0 ? `INSERT INTO videos (publishDate, videoUrl, userId) VALUES (?, ?, ?)` : `INSERT INTO pending_videos (publishDate, videoUrl, userId) VALUES (?, ?, ?)`
                db.query(q2, [publishDate, videoUrl, userId], (err) => {
                    if(err) {
                        return res.status(500).send('There was an error when setting a q2: ' + err)
                    }
                    return res.status(200).send('Your video has been put in a queue!')
                }) 
            }
            else {
                return res.status(500).send('count does not return a number')
            }
        }
    })
})

app.get('/comments', (req, res) => {
    const {id, postType} = req.query; 
    const q = postType === "post" ? 
    `
        SELECT post_comments.id, publishDate, content, postId, users.username FROM post_comments
        JOIN users ON users.id = post_comments.userId
        WHERE postId=?
    ` 
    : 
    `
        SELECT video_comments.id, publishDate, content, videoId, users.username FROM video_comments
        JOIN users ON users.id = video_comments.userId
        WHERE videoId=?
    `; 
    db.query(q, [id], (err, data) => {
        if(err) {
            return res.status(500).send('There was an error when setting a query: ' + err)
        }
        res.status(200).json(data)
    })
})

app.post('/comments', (req, res) => {
    const {publishDate, content, id, userId, postType} = req.body; 
    const postId = Number(id)
    const q = postType === "post" ? `INSERT INTO post_comments (publishDate, content, postId, userId) VALUES(?, ?, ?, ?)` : `INSERT INTO video_comments (publishDate, content, videoId, userId) VALUES(?, ?, ?, ?)`
    db.query(q, [publishDate, content, postId, userId], (err) => {
        if(err) {
            return res.status(500).send('There was an error when setting a query: ' + err)
        }
        return res.status(200)
    })
})

app.get('/chats', (req, res) => {
    const {userId} = req.query;
    const q = `
        SELECT 
	        post_comments.id AS commentId, 
            post_comments.content AS commentContent, 
            post_comments.publishDate AS commentPublishDate, 
            post_comments.postId, 
            post_comments.userId AS commentUserId, 
            posts.imageUrl, 
            users.id AS authorId, 
            users.username AS authorUsername
        FROM post_comments
        JOIN posts ON post_comments.postId = posts.id 
        JOIN users ON posts.userId = users.id
        WHERE post_comments.userId=?
    `
    db.query(q, [userId], (err, data) => {
        if(err) {
            return res.status(500).send('There was an error when setting a query: ' + err)
        }
        else {
            return res.status(200).json(data)
        }
    })
})

const job = Cron("0 0 * * *", () => {
    try {
        const q1 = "DELETE FROM videos"
        db.query(q1, (err) => {
            if(err) {
                console.log('There was an error when setting a q1 (Cron): ' + err)
            }
            else {
                const q2 = "SELECT * FROM pending_videos LIMIT 1"
                db.query(q2, (err, data) => {
                    if(err) {
                        console.log('There was an error when setting a q2 (Cron): ' + err)
                    }
                    else {
                        if(data.length > 0) {
                            const {publishDate, videoUrl, username} = data
                            const q3 = "INSERT INTO videos (publishDate, videoUrl, username) VALUES (?, ?, ?)"
                            db.query(q3, [publishDate, videoUrl, username], (err) => {
                                console.log('There was an error when setting a q3 (Cron): ' + err)
                            })
                        }
                        else {
                            console.log('pending_videos table does not contain any videos (Cron)')
                        }
                    }
                })
            }
        })
    }
    catch (err) {
        console.log("There was an error when setting queries (Cron): " + err)
    }
})

db.connect((err) => {
    if(err) {    
        return console.log("There an error was with connection to database" + err.message) 
    } 

    console.log("Connection to database was successful")
})

/*
    Assuming we have 3 tables: users, posts, likedPosts
    likedPost table will look like following: 

    id | publishDate | content | userId | postId
    1  |  2020-01-07 |  'some' |   1    |    3
    2  |  2021-10-10 |  'what' |   4    |    16
    3  |  2024-05-16 |  'ifia' |   10   |    10
    4  |  2020-01-07 |  'some' |   1    |    6
    5  |  2021-10-10 |  'what' |   10   |    10
    6  |  2024-05-16 |  'ifia' |   10   |    7


    which provides the data of what post were liked by a particular user. 
    now, we need to somehow interact with that table: how we are going to fill it with users and post data.


    ActionButtons.jsx: 
    async function handleLike() {
        const isLiked = await checkIfPostIsLiked() 

        if(!isLiked) {
            const data = {
                userId: user.id, 
                postId: post.id
            }
            const response = await axios.post('localhost:8080/likes', data)
        }
    }


    index.js: 
    app.post('/likes', (req, res) => {
        const {userId, postId} = req.body; 
        const q = INSERT INTO liked_posts (userId, postId) VALUES(?, ?)   
        db.query(q, [userId, postId], (err, data) => {
            if(err) {
                // handle error
            }    
            const q2 = `UPDATE posts SET likes = likes + 1 WHERE id=?`
            db.query(q2, [postId], (err) => {
                if(err) {
                    // handle error
                }  
                const q3 = `SELECT likes FROM posts WHERE id=?`
                db.query(q3, [postId], (err, data) => {
                    if(err) {
                        // handle error
                    }   
                    res.status(200).json(data) 
                })  
            })
        })  
    })
*/