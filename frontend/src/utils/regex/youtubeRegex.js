const youtubeRegex = new RegExp(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^&\n]{11}|[^&\n]{26}|[^&\n]{31})$/)

export default youtubeRegex