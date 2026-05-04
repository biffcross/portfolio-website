import BiffImage from '../Biff.jpeg'

const About = () => {
  return (
    <div className="about-page">
      <h1>About Biff Cross</h1>
      <div className="about-container">
        <div className="about-image">
          <img src={BiffImage} alt="Biff Cross" />
        </div>
        <div className="about-text">
          <p>
            I am a photographer, from Norwich, England. My Current practice is engaged in 
            extreme sports such as freestyle skiing, snowboarding, Climbing and skateboarding.
          </p>
          
          <p>
            My main influences come from the works of early skateboarding photographers such 
            as J. Grant Brittain and Attiba Jefferson. I aim to bring the visual style of 
            skateboarding into other extreme sports, through the use of similar visual 
            techniques, and documenting the strong culture around these sports.
          </p>
          
          <p>
            My body of work focuses on the movement, determination and skills of top athletes 
            in their field through both stills and moving image.
          </p>
          
          <p>
            After photographing the LAAX open freeski world cup, and Shaun Whites 'The Snow 
            League' Final. I am now looking to bring my expertise in action sports into the 
            advertising world, and work with brands on creative advertising within the sports 
            industry.
          </p>
        </div>
      </div>
    </div>
  )
}

export default About