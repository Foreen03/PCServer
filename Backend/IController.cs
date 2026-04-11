using Photino.NET;

namespace Backend
{
    public interface IController
    {
        void SetWindow(PhotinoWindow window);
        void Activate();
        void Deactivate();
        void ProcessData(string data);
    }
}
