import { memo } from "react"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"

const Footnote = memo(function Footnote() {
    return (
        <Box sx={{
            marginTop: "10px", 
            marginBottom: "50px", 
        }}>
            <Typography>🎉 That's all folks!</Typography>
        </Box>
    )
})

export default Footnote