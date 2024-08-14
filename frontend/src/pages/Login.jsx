import Box from "@mui/material/Box"
import InputSection from "../components/Registration/InputSection"

const Login = () => {
  return (
    <Box sx={{
      display: "flex", 
      flexDirection: "column",
      width: "100vw", 
      height: "100vh", 
      paddingTop: "50px", 
      paddingBottom: "10px", 
      paddingInline: "10px"}}>
        <InputSection />
    </Box>
  )
}

export default Login